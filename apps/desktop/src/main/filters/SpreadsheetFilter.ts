import * as XLSX from 'xlsx';
import { readFileSync, writeFileSync } from 'fs';
import { extname } from 'path';
import { 
  Segment, 
  SegmentStatus, 
  parseDisplayTextToTokens, 
  computeTagsSignature, 
  computeMatchKey, 
  computeSrcHash 
} from '@cat/core';
import { randomUUID } from 'crypto';

export interface ImportOptions {
  hasHeader: boolean;
  sourceCol: number;
  targetCol: number;
  contextCol?: number;
}

export class SpreadsheetFilter {
  private readWorkbook(filePath: string) {
    const fileBuffer = readFileSync(filePath);
    return XLSX.read(fileBuffer, { type: 'buffer' });
  }

  private detectBookType(filePath: string): XLSX.BookType {
    const extension = extname(filePath).toLowerCase();
    if (extension === '.csv') return 'csv';
    if (extension === '.xls') return 'xls';
    return 'xlsx';
  }

  /**
   * Import a spreadsheet file (XLSX/CSV) and convert to Segments
   */
  public async import(
    filePath: string, 
    projectId: number, 
    fileId: number,
    options: ImportOptions
  ): Promise<Segment[]> {
    console.log(`[SpreadsheetFilter] Reading file: ${filePath}`);
    const workbook = this.readWorkbook(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Read as array of arrays
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    console.log(`[SpreadsheetFilter] Read ${rawData.length} rows from sheet: ${firstSheetName}`);
    
    const segments: Segment[] = [];
    const startIndex = options.hasHeader ? 1 : 0;
    
    for (let i = startIndex; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row) continue;

      const sourceText = row[options.sourceCol] !== undefined ? String(row[options.sourceCol]) : '';
      if (!sourceText.trim()) {
        console.log(`[SpreadsheetFilter] Skipping row ${i}: source text is empty`);
        continue;
      }

      const targetText = row[options.targetCol] !== undefined ? String(row[options.targetCol]) : '';
      const context = options.contextCol !== undefined ? String(row[options.contextCol] || '') : undefined;
      
      const sourceTokens = parseDisplayTextToTokens(sourceText);
      const targetTokens = targetText ? parseDisplayTextToTokens(targetText) : [];
      
      const tagsSignature = computeTagsSignature(sourceTokens);
      const matchKey = computeMatchKey(sourceTokens);
      const srcHash = computeSrcHash(matchKey, tagsSignature);

      segments.push({
        segmentId: randomUUID(),
        fileId,
        orderIndex: i,
        sourceTokens,
        targetTokens,
        status: targetText ? 'translated' : 'new',
        tagsSignature,
        matchKey,
        srcHash,
        meta: {
          rowRef: i + 1, // 1-based row reference
          context,
          updatedAt: new Date().toISOString()
        }
      });
    }
    
    return segments;
  }

  /**
   * Get first few rows of a spreadsheet for preview
   */
  public async getPreview(filePath: string, rowLimit: number = 10): Promise<any[][]> {
    const workbook = this.readWorkbook(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0 }) as any[][];
    return rawData.slice(0, rowLimit);
  }

  /**
   * Export segments back to a spreadsheet, preserving original structure if possible
   * For v0.1, we'll implement a simple "Export to New File" logic that follows the protocol.
   */
  public async export(
    originalFilePath: string,
    segments: Segment[],
    options: ImportOptions,
    outputPath: string
  ): Promise<void> {
    const workbook = this.readWorkbook(originalFilePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // We update the worksheet in-place for high fidelity
    for (const seg of segments) {
      const rowIndex = seg.orderIndex; // 0-based index from rawData
      const targetText = seg.targetTokens.map(t => t.content).join('');
      
      // XLSX row/col are 0-based in some utilities but cells are A1, B2...
      // sheet_to_json with header:1 gave us the array.
      // To write back, we can use XLSX.utils.sheet_add_aoa or direct cell access.
      
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: options.targetCol });
      worksheet[cellAddress] = { t: 's', v: targetText };
      
      // Optionally write back status or other meta to specific columns if protocol allows
    }
    
    const bookType = this.detectBookType(outputPath);
    const data = XLSX.write(workbook, {
      bookType,
      type: 'buffer'
    }) as Buffer | Uint8Array | string;

    if (typeof data === 'string') {
      writeFileSync(outputPath, data, 'utf8');
      return;
    }

    writeFileSync(outputPath, Buffer.from(data));
  }
}
