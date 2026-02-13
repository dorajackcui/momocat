import React, { useEffect, useState } from 'react';
import { ProjectType } from '@cat/core';
import type { ImportOptions, SpreadsheetPreviewData } from '../../../shared/ipc';

interface ColumnSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: ImportOptions) => void;
  previewData: SpreadsheetPreviewData;
  projectType?: ProjectType;
}

export function ColumnSelector({
  isOpen,
  onClose,
  onConfirm,
  previewData,
  projectType = 'translation',
}: ColumnSelectorProps) {
  const [hasHeader, setHasHeader] = useState(true);
  const [sourceCol, setSourceCol] = useState(0);
  const [targetCol, setTargetCol] = useState(1);
  const [contextCol, setContextCol] = useState<number | undefined>(undefined);

  const isReviewProject = projectType === 'review';
  const sourceLabel = isReviewProject ? 'Translation Column' : 'Source Column';
  const targetLabel = isReviewProject ? 'Review Output Column' : 'Target Column';
  const contextLabel = isReviewProject ? 'Original Column' : 'Comment/Context Column';
  const sourceTagLabel = isReviewProject ? 'Translation' : 'Source';
  const targetTagLabel = isReviewProject ? 'Review Output' : 'Target';
  const contextTagLabel = isReviewProject ? 'Original' : 'Comment';

  const maxCols = previewData.length > 0 ? previewData[0].length : 0;
  const colIndexes = Array.from({ length: maxCols }, (_, i) => i);

  useEffect(() => {
    if (!isOpen || !isReviewProject) return;
    if (contextCol === undefined && colIndexes.length > 0) {
      setContextCol(0);
    }
  }, [colIndexes.length, contextCol, isOpen, isReviewProject]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Import Configuration</h2>
            <p className="text-sm text-gray-500 mt-1">
              {isReviewProject
                ? 'Select translation/original/output columns for AI review'
                : 'Select the columns to import from your spreadsheet'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-3 gap-8 mb-8">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                {sourceLabel}
              </label>
              <select 
                value={sourceCol}
                onChange={(e) => setSourceCol(parseInt(e.target.value))}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
              >
                {colIndexes.map(i => (
                  <option key={i} value={i}>Column {XLSX_COL_NAME(i)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                {targetLabel}
              </label>
              <select 
                value={targetCol}
                onChange={(e) => setTargetCol(parseInt(e.target.value))}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
              >
                {colIndexes.map(i => (
                  <option key={i} value={i}>Column {XLSX_COL_NAME(i)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                {contextLabel}
              </label>
              <select 
                value={
                  contextCol === undefined
                    ? isReviewProject
                      ? (colIndexes[0] ?? 0)
                      : -1
                    : contextCol
                }
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isReviewProject && val === -1) {
                    setContextCol(undefined);
                    return;
                  }
                  setContextCol(val);
                }}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
              >
                {!isReviewProject && <option value={-1}>None (Ignore)</option>}
                {colIndexes.map(i => (
                  <option key={i} value={i}>Column {XLSX_COL_NAME(i)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-6 bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
            <input 
              type="checkbox" 
              id="hasHeader" 
              checked={hasHeader}
              onChange={(e) => setHasHeader(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="hasHeader" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
              First row is a header (Skip it)
            </label>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Preview (First 10 rows)</h3>
            <div className="border border-gray-200 rounded-xl overflow-hidden overflow-x-auto shadow-sm">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {colIndexes.map(i => (
                      <th key={i} className={`px-4 py-3 font-bold text-[11px] uppercase tracking-tight ${
                        i === sourceCol ? 'text-blue-600 bg-blue-50/50' : 
                        i === targetCol ? 'text-green-600 bg-green-50/50' :
                        i === contextCol ? 'text-purple-600 bg-purple-50/50' :
                        'text-gray-500'
                      }`}>
                        Col {XLSX_COL_NAME(i)}
                        {i === sourceCol && <span className="block text-[9px] mt-0.5">{sourceTagLabel}</span>}
                        {i === targetCol && <span className="block text-[9px] mt-0.5">{targetTagLabel}</span>}
                        {i === contextCol && <span className="block text-[9px] mt-0.5">{contextTagLabel}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewData.map((row, rowIndex) => (
                    <tr key={rowIndex} className={`${hasHeader && rowIndex === 0 ? 'bg-gray-50/80 opacity-60 italic' : 'bg-white'}`}>
                      {colIndexes.map(i => (
                        <td key={i} className={`px-4 py-3 truncate max-w-[200px] text-xs ${
                          i === sourceCol ? 'bg-blue-50/20 font-medium' : 
                          i === targetCol ? 'bg-green-50/20' :
                          i === contextCol ? 'bg-purple-50/20' :
                          ''
                        }`}>
                          {row[i] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
            onClick={() =>
              onConfirm({
                hasHeader,
                sourceCol,
                targetCol,
                contextCol: isReviewProject ? contextCol ?? 0 : contextCol,
              })
            }
            className="px-8 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 shadow-md shadow-blue-200 transition-all hover:-translate-y-0.5"
          >
            Start Import
          </button>
        </div>
      </div>
    </div>
  );
}

function XLSX_COL_NAME(n: number): string {
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode(n % 26 + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}
