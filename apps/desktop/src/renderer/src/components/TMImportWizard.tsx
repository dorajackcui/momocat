import React, { useEffect, useRef, useState } from 'react';
import { apiClient } from '../services/apiClient';
import type {
  ImportExecutionResult,
  JobProgressEvent,
  SpreadsheetPreviewData,
  StructuredJobError,
  TMImportOptions,
} from '../../../shared/ipc';

interface TMImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: TMImportOptions) => void;
  jobId: string | null;
  onJobCompleted: (result: ImportExecutionResult) => void;
  onJobFailed: (error: StructuredJobError) => void;
  previewData: SpreadsheetPreviewData;
}

export function TMImportWizard({
  isOpen,
  onClose,
  onConfirm,
  jobId,
  onJobCompleted,
  onJobFailed,
  previewData,
}: TMImportWizardProps) {
  const [hasHeader, setHasHeader] = useState(true);
  const [sourceCol, setSourceCol] = useState(0);
  const [targetCol, setTargetCol] = useState(1);
  const [overwrite, setOverwrite] = useState(false);
  const [jobProgress, setJobProgress] = useState<JobProgressEvent | null>(null);
  const terminalStateHandledRef = useRef(false);

  useEffect(() => {
    terminalStateHandledRef.current = false;
    setJobProgress(null);
  }, [jobId]);

  useEffect(() => {
    if (!isOpen || !jobId) return undefined;

    const unsubscribe = apiClient.onJobProgress((progress) => {
      if (progress.jobId !== jobId) return;
      setJobProgress(progress);

      if (terminalStateHandledRef.current) return;

      if (progress.status === 'completed') {
        terminalStateHandledRef.current = true;
        if (progress.result?.kind === 'tm-import') {
          onJobCompleted({
            success: progress.result.success,
            skipped: progress.result.skipped,
          });
        } else {
          onJobCompleted({ success: 0, skipped: 0 });
        }
      }

      if (progress.status === 'failed') {
        terminalStateHandledRef.current = true;
        onJobFailed(
          progress.error ?? {
            code: 'TM_IMPORT_FAILED',
            message: progress.message || 'TM import failed',
          },
        );
      }
    });

    return () => unsubscribe();
  }, [isOpen, jobId, onJobCompleted, onJobFailed]);

  if (!isOpen) return null;

  const maxCols = previewData.length > 0 ? previewData[0].length : 0;
  const colIndexes = Array.from({ length: maxCols }, (_, i) => i);

  if (jobId) {
    const progress = jobProgress?.progress ?? 0;
    const clampedProgress = Math.max(0, Math.min(progress, 100));
    const progressMessage = jobProgress?.message || 'Starting import...';
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center animate-in fade-in zoom-in duration-200">
          <div className="mb-6">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Importing TM...</h2>
            <p className="text-sm text-gray-500 mt-1">{progressMessage}</p>
          </div>

          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <div>
                <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                  Progress
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold inline-block text-blue-600">
                  {clampedProgress}%
                </span>
              </div>
            </div>
            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-100">
              <div
                style={{ width: `${clampedProgress}%` }}
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-300"
              />
            </div>
            <p className="text-[10px] text-gray-400 font-medium">Job ID: {jobId}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Import TM from File</h2>
            <p className="text-sm text-gray-500 mt-1">Map columns and configure import filters</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Source Text Column (原文)
              </label>
              <select
                value={sourceCol}
                onChange={(e) => setSourceCol(parseInt(e.target.value))}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
              >
                {colIndexes.map((i) => (
                  <option key={i} value={i}>
                    Column {XLSX_COL_NAME(i)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Target Text Column (译文)
              </label>
              <select
                value={targetCol}
                onChange={(e) => setTargetCol(parseInt(e.target.value))}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
              >
                {colIndexes.map((i) => (
                  <option key={i} value={i}>
                    Column {XLSX_COL_NAME(i)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
              <input
                type="checkbox"
                id="hasHeader"
                checked={hasHeader}
                onChange={(e) => setHasHeader(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="hasHeader"
                className="text-sm font-medium text-gray-700 cursor-pointer select-none"
              >
                First row is a header (Skip it)
              </label>
            </div>

            <div className="flex items-center gap-3 bg-purple-50/50 p-4 rounded-xl border border-purple-100/50">
              <input
                type="checkbox"
                id="overwrite"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
              />
              <label
                htmlFor="overwrite"
                className="text-sm font-medium text-gray-700 cursor-pointer select-none"
              >
                Overwrite existing entries
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Preview & Filtering
            </h3>
            <p className="text-[11px] text-gray-500 italic mb-2">
              Note: Empty source/target rows will be filtered out automatically.
            </p>
            <div className="border border-gray-200 rounded-xl overflow-hidden overflow-x-auto shadow-sm">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {colIndexes.map((i) => (
                      <th
                        key={i}
                        className={`px-4 py-3 font-bold text-[11px] uppercase tracking-tight ${
                          i === sourceCol
                            ? 'text-blue-600 bg-blue-50/50'
                            : i === targetCol
                              ? 'text-green-600 bg-green-50/50'
                              : 'text-gray-500'
                        }`}
                      >
                        Col {XLSX_COL_NAME(i)}
                        {i === sourceCol && <span className="block text-[9px] mt-0.5">Source</span>}
                        {i === targetCol && <span className="block text-[9px] mt-0.5">Target</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewData.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className={`${hasHeader && rowIndex === 0 ? 'bg-gray-50/80 opacity-60 italic' : 'bg-white'}`}
                    >
                      {colIndexes.map((i) => (
                        <td
                          key={i}
                          className={`px-4 py-3 truncate max-w-[200px] text-xs ${
                            i === sourceCol
                              ? 'bg-blue-50/20 font-medium'
                              : i === targetCol
                                ? 'bg-green-50/20'
                                : ''
                          }`}
                        >
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
            onClick={() => {
              onConfirm({ hasHeader, sourceCol, targetCol, overwrite });
            }}
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
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}
