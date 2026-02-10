import { randomUUID } from 'crypto';
import { join } from 'path';
import { Worker } from 'worker_threads';
import { existsSync, readFileSync } from 'fs';
import * as XLSX from 'xlsx';
import {
  Segment,
  computeMatchKey,
  computeSrcHash,
  computeTagsSignature,
  parseDisplayTextToTokens,
  serializeTokensToDisplayText
} from '@cat/core';
import { ProgressEmitter, ProjectRepository, SegmentRepository, TMRepository, TransactionManager } from '../ports';
import { TMService } from '../TMService';
import { SegmentService } from '../SegmentService';

export interface TMImportOptions {
  sourceCol: number;
  targetCol: number;
  hasHeader: boolean;
  overwrite: boolean;
}

export class TMModule {
  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly segmentRepo: SegmentRepository,
    private readonly tmRepo: TMRepository,
    private readonly tx: TransactionManager,
    private readonly tmService: TMService,
    private readonly segmentService: SegmentService,
    private readonly dbPath: string,
    private readonly emitProgress: ProgressEmitter
  ) {}

  public async get100Match(projectId: number, srcHash: string) {
    return this.tmService.find100Match(projectId, srcHash);
  }

  public async findMatches(projectId: number, segment: Segment) {
    return this.tmService.findMatches(projectId, segment);
  }

  public async searchConcordance(projectId: number, query: string) {
    return this.tmRepo.searchConcordance(projectId, query);
  }

  public async listTMs(type?: 'working' | 'main') {
    const tms = this.tmRepo.listTMs(type);
    return tms.map(tm => ({
      ...tm,
      stats: this.tmRepo.getTMStats(tm.id)
    }));
  }

  public async createTM(name: string, srcLang: string, tgtLang: string, type: 'working' | 'main' = 'main') {
    return this.tmRepo.createTM(name, srcLang, tgtLang, type);
  }

  public async deleteTM(tmId: string) {
    this.tmRepo.deleteTM(tmId);
  }

  public async getProjectMountedTMs(projectId: number) {
    const mounted = this.tmRepo.getProjectMountedTMs(projectId);
    return mounted.map(tm => ({
      ...tm,
      entryCount: this.tmRepo.getTMStats(tm.id).entryCount
    }));
  }

  public async mountTMToProject(projectId: number, tmId: string, priority?: number, permission?: string) {
    this.tmRepo.mountTMToProject(projectId, tmId, priority, permission);
  }

  public async unmountTMFromProject(projectId: number, tmId: string) {
    this.tmRepo.unmountTMFromProject(projectId, tmId);
  }

  public async getTMImportPreview(filePath: string): Promise<any[][]> {
    const workbook = XLSX.read(readFileSync(filePath), { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0 }) as any[][];
    return rawData.slice(0, 10);
  }

  public async importTMEntries(tmId: string, filePath: string, options: TMImportOptions): Promise<{ success: number; skipped: number }> {
    try {
      return await this.importTMEntriesInWorker(tmId, filePath, options);
    } catch (error) {
      console.error('[TMModule] TM import worker failed, falling back to main thread:', error);
      return this.importTMEntriesInMainThread(tmId, filePath, options);
    }
  }

  private async importTMEntriesInWorker(
    tmId: string,
    filePath: string,
    options: TMImportOptions
  ): Promise<{ success: number; skipped: number }> {
    const candidatePaths = [
      join(__dirname, 'tmImportWorker.js'),
      join(__dirname, '../tmImportWorker.js'),
      join(__dirname, '../../tmImportWorker.js')
    ];
    const workerPath = candidatePaths.find(path => existsSync(path));
    if (!workerPath) {
      throw new Error(`TM import worker not found. Tried: ${candidatePaths.join(', ')}`);
    }

    return new Promise((resolve, reject) => {
      const worker = new Worker(workerPath, {
        workerData: {
          dbPath: this.dbPath,
          tmId,
          filePath,
          options
        }
      });
      let settled = false;

      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      worker.on('message', (message: any) => {
        if (!message || typeof message !== 'object') return;

        if (message.type === 'progress') {
          this.emitProgress({
            type: 'tm-import',
            current: Number(message.current) || 0,
            total: Number(message.total) || 0,
            message: typeof message.message === 'string' ? message.message : undefined
          });
          return;
        }

        if (message.type === 'done') {
          if (settled) return;
          settled = true;
          resolve(message.result ?? { success: 0, skipped: 0 });
          return;
        }

        if (message.type === 'error') {
          fail(new Error(message.error || 'TM import worker failed'));
        }
      });

      worker.on('error', fail);
      worker.on('exit', (code) => {
        if (settled) return;
        if (code === 0) {
          fail(new Error('TM import worker exited without returning result'));
          return;
        }
        fail(new Error(`TM import worker exited with code ${code}`));
      });
    });
  }

  private async importTMEntriesInMainThread(
    tmId: string,
    filePath: string,
    options: TMImportOptions
  ): Promise<{ success: number; skipped: number }> {
    const tm = this.tmRepo.getTM(tmId);
    if (!tm) throw new Error('Target TM not found');

    this.emitProgress({ type: 'tm-import', current: 0, total: 1, message: 'Reading spreadsheet...' });

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
    this.emitProgress({ type: 'tm-import', current: 0, total: totalRows, message: 'Preparing import...' });

    for (let i = startIndex; i < rawData.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, rawData.length);

      this.tx.runInTransaction(() => {
        for (let j = i; j < end; j++) {
          const row = rawData[j];
          if (!row) continue;

          const sourceText = row[options.sourceCol] !== undefined ? String(row[options.sourceCol]).trim() : '';
          const targetText = row[options.targetCol] !== undefined ? String(row[options.targetCol]).trim() : '';

          if (!sourceText || !targetText) {
            skipped++;
            continue;
          }

          const sourceTokens = parseDisplayTextToTokens(sourceText);
          const targetTokens = parseDisplayTextToTokens(targetText);
          const tagsSignature = computeTagsSignature(sourceTokens);
          const matchKey = computeMatchKey(sourceTokens);
          const srcHash = computeSrcHash(matchKey, tagsSignature);

          const now = new Date().toISOString();
          const entryBase = {
            id: randomUUID(),
            tmId,
            projectId: 0,
            srcLang: tm.srcLang,
            tgtLang: tm.tgtLang,
            srcHash,
            matchKey,
            tagsSignature,
            sourceTokens,
            targetTokens,
            usageCount: 1,
            createdAt: now,
            updatedAt: now
          };

          if (options.overwrite) {
            const entryId = this.tmRepo.upsertTMEntryBySrcHash(entryBase);
            this.tmRepo.replaceTMFts(tmId, sourceText, targetText, entryId);
            success++;
            continue;
          }

          const insertedId = this.tmRepo.insertTMEntryIfAbsentBySrcHash(entryBase);
          if (!insertedId) {
            skipped++;
            continue;
          }

          this.tmRepo.insertTMFts(tmId, sourceText, targetText, insertedId);
          success++;
        }
      });

      const processedRows = end - startIndex;
      this.emitProgress({
        type: 'tm-import',
        current: processedRows,
        total: totalRows,
        message: `Imported ${processedRows} of ${totalRows} rows...`
      });

      await new Promise<void>(resolve => setImmediate(resolve));
    }

    return { success, skipped };
  }

  public async commitToMainTM(tmId: string, fileId: number) {
    const tm = this.tmRepo.getTM(tmId);
    if (!tm) throw new Error('Target TM not found');

    const segments = this.segmentRepo.getSegmentsPage(fileId, 0, 1000000);
    const confirmedSegments = segments.filter(s => s.status === 'confirmed');

    for (const seg of confirmedSegments) {
      const entryId = this.tmRepo.upsertTMEntryBySrcHash({
        id: randomUUID(),
        tmId,
        projectId: 0,
        srcLang: tm.srcLang,
        tgtLang: tm.tgtLang,
        srcHash: seg.srcHash,
        matchKey: seg.matchKey,
        tagsSignature: seg.tagsSignature,
        sourceTokens: seg.sourceTokens,
        targetTokens: seg.targetTokens,
        originSegmentId: seg.segmentId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 1
      });

      this.tmRepo.replaceTMFts(
        tmId,
        serializeTokensToDisplayText(seg.sourceTokens),
        serializeTokensToDisplayText(seg.targetTokens),
        entryId
      );
    }

    return confirmedSegments.length;
  }

  public async batchMatchFileWithTM(
    fileId: number,
    tmId: string
  ): Promise<{ total: number; matched: number; applied: number; skipped: number }> {
    const file = this.projectRepo.getFile(fileId);
    if (!file) throw new Error('File not found');

    const tm = this.tmRepo.getTM(tmId);
    if (!tm) throw new Error('TM not found');

    const mountedTMs = this.tmRepo.getProjectMountedTMs(file.projectId);
    if (!mountedTMs.some(mounted => mounted.id === tmId)) {
      throw new Error('TM is not mounted to this file project');
    }

    const segments = this.segmentRepo.getSegmentsPage(fileId, 0, 1000000);
    let matched = 0;
    let skipped = 0;
    const updates: Array<{ segmentId: string; targetTokens: Segment['targetTokens']; status: 'confirmed' }> = [];

    for (const seg of segments) {
      const match = this.tmRepo.findTMEntryByHash(tmId, seg.srcHash);
      if (!match) continue;

      matched += 1;
      if (seg.status === 'confirmed') {
        skipped += 1;
        continue;
      }

      updates.push({
        segmentId: seg.segmentId,
        targetTokens: match.targetTokens,
        status: 'confirmed'
      });
    }

    if (updates.length > 0) {
      await this.segmentService.updateSegmentsAtomically(updates);
    }

    return {
      total: segments.length,
      matched,
      applied: updates.length,
      skipped
    };
  }
}
