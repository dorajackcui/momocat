import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { extractSheetRows } from './sheetRows';

describe('extractSheetRows', () => {
  it('extracts only real valued rows even when worksheet range is huge', () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Source', 'Target'],
      ['s1', 't1'],
      ['s2', 't2'],
      ['s3', 't3'],
      ['s4', 't4'],
      ['s5', 't5'],
      ['s6', 't6'],
      ['s7', 't7'],
      ['s8', 't8'],
    ]);

    // Simulate files whose !ref is bloated by formatting metadata.
    worksheet['!ref'] = 'A1:B1047589';

    const rows = extractSheetRows(worksheet, { columnIndexes: [0, 1] });
    expect(rows).toHaveLength(9);
    expect(rows[0].rowIndex).toBe(0);
    expect(rows[8].rowIndex).toBe(8);
    expect(rows[8].cells[0]).toBe('s8');
    expect(rows[8].cells[1]).toBe('t8');
  });

  it('supports preview row limits and ignores blank-only cells', () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['a', 'b', 'c'],
      ['', 'x', ''],
      ['   ', '', ''],
      ['d', '', 'e'],
    ]);

    const rows = extractSheetRows(worksheet, { maxRows: 2 });
    expect(rows).toHaveLength(2);
    expect(rows[0].cells[0]).toBe('a');
    expect(rows[1].cells[1]).toBe('x');
  });
});
