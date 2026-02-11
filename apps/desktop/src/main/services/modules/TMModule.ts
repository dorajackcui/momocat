import { randomUUID } from 'crypto';
import { join } from 'path';
import { Worker } from 'worker_threads';
import { access, readFile } from 'fs/promises';
import * as XLSX from 'xlsx';
import {
  Segment,
  computeMatchKey,
  computeSrcHash,
  computeTagsSignature,
  parseDisplayTextToTokens,
  serializeTokensToDisplayText,
} from '@cat/core';
import { extractSheetRows } from '../../filters/sheetRows';
import {
  ProgressEmitter,
  ProjectRepository,
  SegmentRepository,
  TMConcordanceRecord,
  TMRepository,
  TransactionManager,
  SpreadsheetPreviewData,
} from '../ports';
import { TMService } from '../TMService';
import { SegmentService } from '../SegmentService';
import type { TMImportOptions } from '../../../shared/ipc';

export interface ImportProgress {
  current: number;
  total: number;
  message?: string;
}

type ImportProgressCallback = (progress: ImportProgress) => void;

interface TMImportWorkerProgressMessage {
  type: 'progress';
  current: number;
  total: number;
  message?: string;
}

interface TMImportWorkerDoneMessage {
  type: 'done';
  result?: { success: number; skipped: number };
}

interface TMImportWorkerErrorMessage {
  type: 'error';
  error?: string;
}

type TMImportWorkerMessage =
  | TMImportWorkerProgressMessage
  | TMImportWorkerDoneMessage
  | TMImportWorkerErrorMessage;

export class TMModule {
  private static readonly SEGMENT_PAGE_SIZE = 2000;

  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly segmentRepo: SegmentRepository,
    private readonly tmRepo: TMRepository,
    private readonly tx: TransactionManager,
    private readonly tmService: TMService,
    private readonly segmentService: SegmentService,
    private readonly dbPath: string,
    private readonly emitProgress: ProgressEmitter,
  ) {}

  public async get100Match(projectId: number, srcHash: string) {
    return this.tmService.find100Match(projectId, srcHash);
  }

  public async findMatches(projectId: number, segment: Segment) {
    return this.tmService.findMatches(projectId, segment);
  }

  public async searchConcordance(projectId: number, query: string): Promise<TMConcordanceRecord[]> {
    const entries = this.tmRepo.searchConcordance(projectId, query);
    const mountedById = new Map(
      this.tmRepo.getProjectMountedTMs(projectId).map((tm) => [tm.id, tm] as const),
    );

    return entries.map((entry) => {
      const tm = mountedById.get(entry.tmId);
      return {
        ...entry,
        tmName: tm?.name ?? 'Unknown TM',
        tmType: tm?.type ?? 'main',
      };
    });
  }

  public async listTMs(type?: 'working' | 'main') {
    const tms = this.tmRepo.listTMs(type);
    return tms.map((tm) => ({
      ...tm,
      stats: this.tmRepo.getTMStats(tm.id),
    }));
  }

  public async createTM(
    name: string,
    srcLang: string,
    tgtLang: string,
    type: 'working' | 'main' = 'main',
  ) {
    return this.tmRepo.createTM(name, srcLang, tgtLang, type);
  }

  public async deleteTM(tmId: string) {
    this.tmRepo.deleteTM(tmId);
  }

  public async getProjectMountedTMs(projectId: number) {
    const mounted = this.tmRepo.getProjectMountedTMs(projectId);
    return mounted.map((tm) => ({
      ...tm,
      entryCount: this.tmRepo.getTMStats(tm.id).entryCount,
    }));
  }

  public async mountTMToProject(
    projectId: number,
    tmId: string,
    priority?: number,
    permission?: string,
  ) {
    this.tmRepo.mountTMToProject(projectId, tmId, priority, permission);
  }

  public async unmountTMFromProject(projectId: number, tmId: string) {
    this.tmRepo.unmountTMFromProject(projectId, tmId);
  }

  public async getTMImportPreview(filePath: string): Promise<SpreadsheetPreviewData> {
    const workbook = XLSX.read(await readFile(filePath), { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    return extractSheetRows(worksheet, { maxRows: 10 }).map((row) => row.cells);
  }

  public async importTMEntries(
    tmId: string,
    filePath: string,
    options: TMImportOptions,
    onProgress?: ImportProgressCallback,
  ): Promise<{ success: number; skipped: number }> {
    try {
      return await this.importTMEntriesInWorker(tmId, filePath, options, onProgress);
    } catch (error) {
      console.error('[TMModule] TM import worker failed, falling back to main thread:', error);
      return this.importTMEntriesInMainThread(tmId, filePath, options, onProgress);
    }
  }

  private async importTMEntriesInWorker(
    tmId: string,
    filePath: string,
    options: TMImportOptions,
    onProgress?: ImportProgressCallback,
  ): Promise<{ success: number; skipped: number }> {
    const candidatePaths = [
      join(__dirname, 'tmImportWorker.js'),
      join(__dirname, '../tmImportWorker.js'),
      join(__dirname, '../../tmImportWorker.js'),
    ];
    const workerPath = await this.resolveWorkerPath(candidatePaths);
    if (!workerPath) {
      throw new Error(`TM import worker not found. Tried: ${candidatePaths.join(', ')}`);
    }

    return new Promise((resolve, reject) => {
      const worker = new Worker(workerPath, {
        workerData: {
          dbPath: this.dbPath,
          tmId,
          filePath,
          options,
        },
      });
      let settled = false;

      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      worker.on('message', (message: TMImportWorkerMessage) => {
        if (!message || typeof message !== 'object') return;

        if (message.type === 'progress') {
          this.emitImportProgress(
            {
              current: Number(message.current) || 0,
              total: Number(message.total) || 0,
              message: typeof message.message === 'string' ? message.message : undefined,
            },
            onProgress,
          );
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
    options: TMImportOptions,
    onProgress?: ImportProgressCallback,
  ): Promise<{ success: number; skipped: number }> {
    const tm = this.tmRepo.getTM(tmId);
    if (!tm) throw new Error('Target TM not found');

    this.emitImportProgress(
      {
        current: 0,
        total: 1,
        message: 'Reading spreadsheet...',
      },
      onProgress,
    );

    const workbook = XLSX.read(await readFile(filePath), { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const sourceRows = extractSheetRows(worksheet, {
      columnIndexes: [options.sourceCol, options.targetCol],
    });
    const rows = options.hasHeader ? sourceRows.slice(1) : sourceRows;

    const totalRows = rows.length;
    let success = 0;
    let skipped = 0;

    if (totalRows === 0) {
      return { success, skipped };
    }

    const chunkSize = totalRows >= 100000 ? 1500 : 800;
    this.emitImportProgress(
      {
        current: 0,
        total: totalRows,
        message: 'Preparing import...',
      },
      onProgress,
    );

    for (let i = 0; i < rows.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, rows.length);

      this.tx.runInTransaction(() => {
        for (let j = i; j < end; j++) {
          const row = rows[j].cells;

          const sourceText =
            row[options.sourceCol] !== undefined ? String(row[options.sourceCol]).trim() : '';
          const targetText =
            row[options.targetCol] !== undefined ? String(row[options.targetCol]).trim() : '';

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
            updatedAt: now,
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

      const processedRows = end;
      this.emitImportProgress(
        {
          current: processedRows,
          total: totalRows,
          message: `Imported ${processedRows} of ${totalRows} rows...`,
        },
        onProgress,
      );

      await new Promise<void>((resolve) => setImmediate(resolve));
    }

    return { success, skipped };
  }

  private async resolveWorkerPath(candidatePaths: string[]): Promise<string | undefined> {
    for (const candidatePath of candidatePaths) {
      try {
        await access(candidatePath);
        return candidatePath;
      } catch {
        // Ignore missing path candidate and try next.
      }
    }
    return undefined;
  }

  private emitImportProgress(progress: ImportProgress, onProgress?: ImportProgressCallback) {
    this.emitProgress({
      type: 'tm-import',
      current: progress.current,
      total: progress.total,
      message: progress.message,
    });
    onProgress?.(progress);
  }

  public async commitToMainTM(tmId: string, fileId: number) {
    const tm = this.tmRepo.getTM(tmId);
    if (!tm) throw new Error('Target TM not found');

    let confirmedCount = 0;

    this.forEachFileSegment(fileId, (seg) => {
      if (seg.status !== 'confirmed') return;
      confirmedCount += 1;

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
        usageCount: 1,
      });

      this.tmRepo.replaceTMFts(
        tmId,
        serializeTokensToDisplayText(seg.sourceTokens),
        serializeTokensToDisplayText(seg.targetTokens),
        entryId,
      );
    });

    return confirmedCount;
  }

  public async batchMatchFileWithTM(
    fileId: number,
    tmId: string,
  ): Promise<{ total: number; matched: number; applied: number; skipped: number }> {
    const file = this.projectRepo.getFile(fileId);
    if (!file) throw new Error('File not found');

    const tm = this.tmRepo.getTM(tmId);
    if (!tm) throw new Error('TM not found');

    const mountedTMs = this.tmRepo.getProjectMountedTMs(file.projectId);
    if (!mountedTMs.some((mounted) => mounted.id === tmId)) {
      throw new Error('TM is not mounted to this file project');
    }

    let total = 0;
    let matched = 0;
    let skipped = 0;
    const updates: Array<{
      segmentId: string;
      targetTokens: Segment['targetTokens'];
      status: 'confirmed';
    }> = [];

    this.forEachFileSegment(fileId, (seg) => {
      total += 1;
      const match = this.tmRepo.findTMEntryByHash(tmId, seg.srcHash);
      if (!match) return;

      matched += 1;
      if (seg.status === 'confirmed') {
        skipped += 1;
        return;
      }

      updates.push({
        segmentId: seg.segmentId,
        targetTokens: match.targetTokens,
        status: 'confirmed',
      });
    });

    if (updates.length > 0) {
      await this.segmentService.updateSegmentsAtomically(updates);
    }

    return {
      total,
      matched,
      applied: updates.length,
      skipped,
    };
  }

  private forEachFileSegment(fileId: number, visitor: (segment: Segment) => void): void {
    let offset = 0;

    while (true) {
      const page = this.segmentRepo.getSegmentsPage(fileId, offset, TMModule.SEGMENT_PAGE_SIZE);
      if (page.length === 0) break;
      for (const segment of page) {
        visitor(segment);
      }
      if (page.length < TMModule.SEGMENT_PAGE_SIZE) break;
      offset += TMModule.SEGMENT_PAGE_SIZE;
    }
  }
}
