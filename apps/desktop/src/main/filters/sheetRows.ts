import * as XLSX from 'xlsx';

export type SheetCellValue = string | number | boolean | null | undefined;

export interface SheetRow {
  rowIndex: number;
  cells: SheetCellValue[];
}

interface ExtractSheetRowsOptions {
  columnIndexes?: number[];
  maxRows?: number;
}

function normalizeCellValue(cell: XLSX.CellObject | undefined): SheetCellValue {
  if (!cell) return undefined;
  const rawValue = cell.v;
  if (rawValue === null || rawValue === undefined) return undefined;
  if (typeof rawValue === 'string') {
    return rawValue;
  }
  if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
    return rawValue;
  }
  return String(rawValue);
}

function shouldKeepCell(value: SheetCellValue): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

export function extractSheetRows(
  worksheet: XLSX.WorkSheet,
  options: ExtractSheetRowsOptions = {},
): SheetRow[] {
  const columnSet = options.columnIndexes
    ? new Set(options.columnIndexes.filter((col) => Number.isInteger(col) && col >= 0))
    : null;
  const rowMap = new Map<number, Map<number, SheetCellValue>>();

  for (const [address, cell] of Object.entries(worksheet)) {
    if (address.startsWith('!')) continue;

    const decoded = XLSX.utils.decode_cell(address);
    if (columnSet && !columnSet.has(decoded.c)) continue;

    const value = normalizeCellValue(cell as XLSX.CellObject);
    if (!shouldKeepCell(value)) continue;

    let row = rowMap.get(decoded.r);
    if (!row) {
      row = new Map<number, SheetCellValue>();
      rowMap.set(decoded.r, row);
    }
    row.set(decoded.c, value);
  }

  const sortedRowIndexes = Array.from(rowMap.keys()).sort((a, b) => a - b);
  const limitedIndexes =
    options.maxRows && options.maxRows > 0
      ? sortedRowIndexes.slice(0, options.maxRows)
      : sortedRowIndexes;

  return limitedIndexes.map((rowIndex) => {
    const cells = rowMap.get(rowIndex);
    if (!cells) return { rowIndex, cells: [] };

    const rowArray: SheetCellValue[] = [];
    for (const [colIndex, value] of cells.entries()) {
      rowArray[colIndex] = value;
    }
    return {
      rowIndex,
      cells: rowArray,
    };
  });
}
