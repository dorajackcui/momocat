import { parentPort, workerData } from 'worker_threads';
import { CATDatabase } from '@cat/db';
import {
  parseDisplayTextToTokens,
  computeTagsSignature,
  computeMatchKey,
  computeSrcHash
} from '@cat/core';
import { randomUUID } from 'crypto';
import * as XLSX from 'xlsx';

interface TMImportOptions {
  sourceCol: number;
  targetCol: number;
  hasHeader: boolean;
  overwrite: boolean;
}

interface TMImportWorkerInput {
  dbPath: string;
  tmId: string;
  filePath: string;
  options: TMImportOptions;
}

const port = parentPort;
if (!port) {
  throw new Error('TM import worker requires parentPort');
}

const emitProgress = (current: number, total: number, message?: string) => {
  port.postMessage({
    type: 'progress',
    current,
    total,
    message
  });
};

const run = async () => {
  const input = workerData as TMImportWorkerInput;
  const db = new CATDatabase(input.dbPath);

  try {
    const tm = db.getTM(input.tmId);
    if (!tm) {
      throw new Error('Target TM not found');
    }

    emitProgress(0, 1, 'Reading spreadsheet...');
    const workbook = XLSX.readFile(input.filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    const startIndex = input.options.hasHeader ? 1 : 0;
    const totalRows = Math.max(rawData.length - startIndex, 0);
    let success = 0;
    let skipped = 0;

    if (totalRows === 0) {
      port.postMessage({ type: 'done', result: { success, skipped } });
      return;
    }

    emitProgress(0, totalRows, 'Preparing import...');

    const chunkSize = totalRows >= 100000 ? 1500 : 800;

    for (let i = startIndex; i < rawData.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, rawData.length);

      db.runInTransaction(() => {
        for (let j = i; j < end; j++) {
          const row = rawData[j];
          if (!row) continue;

          const sourceText = row[input.options.sourceCol] !== undefined ? String(row[input.options.sourceCol]).trim() : '';
          const targetText = row[input.options.targetCol] !== undefined ? String(row[input.options.targetCol]).trim() : '';

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
            tmId: input.tmId,
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

          if (input.options.overwrite) {
            const entryId = db.upsertTMEntryBySrcHash(entryBase);
            db.replaceTMFts(input.tmId, sourceText, targetText, entryId);
            success++;
            continue;
          }

          const insertedId = db.insertTMEntryIfAbsentBySrcHash(entryBase);
          if (!insertedId) {
            skipped++;
            continue;
          }

          db.insertTMFts(input.tmId, sourceText, targetText, insertedId);
          success++;
        }
      });

      const processedRows = end - startIndex;
      emitProgress(processedRows, totalRows, `Imported ${processedRows} of ${totalRows} rows...`);
      await new Promise<void>(resolve => setImmediate(resolve));
    }

    port.postMessage({ type: 'done', result: { success, skipped } });
  } finally {
    db.close();
  }
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
  port.postMessage({ type: 'error', error: message });
});
