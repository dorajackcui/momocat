import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import * as XLSX from 'xlsx';
import { Segment } from '@cat/core';
import { ProgressEmitter, TBRepository, TransactionManager } from '../ports';
import { TBService } from '../TBService';

export interface TBImportOptions {
  sourceCol: number;
  targetCol: number;
  noteCol?: number;
  hasHeader: boolean;
  overwrite: boolean;
}

export class TBModule {
  constructor(
    private readonly tbRepo: TBRepository,
    private readonly tx: TransactionManager,
    private readonly tbService: TBService,
    private readonly emitProgress: ProgressEmitter
  ) {}

  public async findTermMatches(projectId: number, segment: Segment) {
    return this.tbService.findMatches(projectId, segment);
  }

  public async listTBs() {
    const tbs = this.tbRepo.listTermBases();
    return tbs.map(tb => ({
      ...tb,
      stats: this.tbRepo.getTermBaseStats(tb.id)
    }));
  }

  public async createTB(name: string, srcLang: string, tgtLang: string) {
    return this.tbRepo.createTermBase(name, srcLang, tgtLang);
  }

  public async deleteTB(tbId: string) {
    this.tbRepo.deleteTermBase(tbId);
  }

  public async getProjectMountedTBs(projectId: number) {
    const mounted = this.tbRepo.getProjectMountedTermBases(projectId);
    return mounted.map(tb => ({
      ...tb,
      stats: this.tbRepo.getTermBaseStats(tb.id)
    }));
  }

  public async mountTBToProject(projectId: number, tbId: string, priority?: number) {
    this.tbRepo.mountTermBaseToProject(projectId, tbId, priority);
  }

  public async unmountTBFromProject(projectId: number, tbId: string) {
    this.tbRepo.unmountTermBaseFromProject(projectId, tbId);
  }

  public async getTBImportPreview(filePath: string): Promise<any[][]> {
    const workbook = XLSX.read(readFileSync(filePath), { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0 }) as any[][];
    return rawData.slice(0, 10);
  }

  public async importTBEntries(tbId: string, filePath: string, options: TBImportOptions): Promise<{ success: number; skipped: number }> {
    const tb = this.tbRepo.getTermBase(tbId);
    if (!tb) throw new Error('Target TB not found');

    this.emitProgress({ type: 'tb-import', current: 0, total: 1, message: 'Reading spreadsheet...' });

    const workbook = XLSX.read(readFileSync(filePath), { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    const startIndex = options.hasHeader ? 1 : 0;
    const totalRows = Math.max(rawData.length - startIndex, 0);
    let success = 0;
    let skipped = 0;

    if (totalRows === 0) {
      return { success, skipped };
    }

    const chunkSize = totalRows >= 100000 ? 1500 : 800;
    this.emitProgress({ type: 'tb-import', current: 0, total: totalRows, message: 'Preparing import...' });

    for (let i = startIndex; i < rawData.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, rawData.length);

      this.tx.runInTransaction(() => {
        for (let j = i; j < end; j++) {
          const row = rawData[j];
          if (!row) continue;

          const srcTerm = row[options.sourceCol] !== undefined ? String(row[options.sourceCol]).trim() : '';
          const tgtTerm = row[options.targetCol] !== undefined ? String(row[options.targetCol]).trim() : '';
          const note =
            options.noteCol !== undefined && row[options.noteCol] !== undefined
              ? String(row[options.noteCol]).trim()
              : null;

          if (!srcTerm || !tgtTerm) {
            skipped += 1;
            continue;
          }

          const entryBase = {
            id: randomUUID(),
            tbId,
            srcTerm,
            tgtTerm,
            note
          };

          if (options.overwrite) {
            this.tbRepo.upsertTBEntryBySrcTerm(entryBase);
            success += 1;
            continue;
          }

          const insertedId = this.tbRepo.insertTBEntryIfAbsentBySrcTerm(entryBase);
          if (!insertedId) {
            skipped += 1;
            continue;
          }

          success += 1;
        }
      });

      const processedRows = end - startIndex;
      this.emitProgress({
        type: 'tb-import',
        current: processedRows,
        total: totalRows,
        message: `Imported ${processedRows} of ${totalRows} rows...`
      });

      await new Promise<void>(resolve => setImmediate(resolve));
    }

    return { success, skipped };
  }
}
