import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';
import type { AppProgressEvent, SpreadsheetPreviewData, TBImportOptions } from '../../../shared/ipc';

interface TBImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: TBImportOptions) => void;
  previewData: SpreadsheetPreviewData;
}

export function TBImportWizard({ isOpen, onClose, onConfirm, previewData }: TBImportWizardProps) {
  const [hasHeader, setHasHeader] = useState(true);
  const [sourceCol, setSourceCol] = useState(0);
  const [targetCol, setTargetCol] = useState(1);
  const [noteCol, setNoteCol] = useState<number | undefined>(2);
  const [overwrite, setOverwrite] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; message?: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const unsubscribe = apiClient.onProgress((data: AppProgressEvent) => {
        if (data.type === 'tb-import') {
          setProgress({ current: data.current, total: data.total, message: data.message });
        }
      });
      return () => unsubscribe();
    }
    setProgress(null);
    return undefined;
  }, [isOpen]);

  if (!isOpen) return null;

  const maxCols = previewData.length > 0 ? previewData[0].length : 0;
  const colIndexes = Array.from({ length: maxCols }, (_, i) => i);

  if (progress) {
    const hasKnownTotal = progress.total > 0;
    const safeTotal = hasKnownTotal ? progress.total : 1;
    const percent = hasKnownTotal ? Math.round((progress.current / safeTotal) * 100) : 0;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Importing Term Base...</h2>
            <p className="text-sm text-gray-500 mt-1">{progress.message || 'Processing rows...'}</p>
          </div>

          <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-emerald-100">
            <div
              style={{ width: `${percent}%` }}
              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-emerald-500 transition-all duration-300"
            />
          </div>
          <p className="text-[10px] text-gray-400 font-medium">
            {hasKnownTotal
              ? `${progress.current.toLocaleString()} / ${progress.total.toLocaleString()} rows processed`
              : 'Initializing import...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Import Terms from File</h2>
            <p className="text-sm text-gray-500 mt-1">Map source/target columns to build your term base.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div>
              <label className="text-sm font-bold text-gray-700">Source Term Column</label>
              <select
                value={sourceCol}
                onChange={(e) => setSourceCol(parseInt(e.target.value))}
                className="mt-2 w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm"
              >
                {colIndexes.map(i => (
                  <option key={i} value={i}>Column {XLSX_COL_NAME(i)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700">Target Term Column</label>
              <select
                value={targetCol}
                onChange={(e) => setTargetCol(parseInt(e.target.value))}
                className="mt-2 w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm"
              >
                {colIndexes.map(i => (
                  <option key={i} value={i}>Column {XLSX_COL_NAME(i)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700">Note Column (Optional)</label>
              <select
                value={noteCol ?? -1}
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10);
                  setNoteCol(next === -1 ? undefined : next);
                }}
                className="mt-2 w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm"
              >
                <option value={-1}>Not used</option>
                {colIndexes.map(i => (
                  <option key={i} value={i}>Column {XLSX_COL_NAME(i)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <label className="flex items-center gap-3 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50">
              <input
                type="checkbox"
                checked={hasHeader}
                onChange={(e) => setHasHeader(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700">First row is header</span>
            </label>
            <label className="flex items-center gap-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Overwrite existing source terms</span>
            </label>
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden overflow-x-auto shadow-sm">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {colIndexes.map(i => (
                    <th key={i} className="px-4 py-3 font-bold text-[11px] uppercase tracking-tight text-gray-500">
                      Col {XLSX_COL_NAME(i)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {previewData.map((row, rowIndex) => (
                  <tr key={rowIndex} className={`${hasHeader && rowIndex === 0 ? 'bg-gray-50/80 opacity-60 italic' : 'bg-white'}`}>
                    {colIndexes.map(i => (
                      <td key={i} className="px-4 py-3 truncate max-w-[240px] text-xs">
                        {row[i] || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-gray-600 font-bold text-sm hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setProgress({ current: 0, total: 0, message: 'Starting import...' });
              onConfirm({ hasHeader, sourceCol, targetCol, noteCol, overwrite });
            }}
            className="px-8 py-2.5 bg-emerald-600 text-white font-bold text-sm rounded-lg hover:bg-emerald-700"
          >
            Start Import
          </button>
        </div>
      </div>
    </div>
  );
}

function XLSX_COL_NAME(n: number): string {
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}
