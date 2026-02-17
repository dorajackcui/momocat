import React, { useEffect, useRef, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { Button, Card, IconButton, Select, Spinner } from './ui';
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
    // Reset per-job progress state immediately when a new job id is assigned.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      <div className="modal-backdrop !z-[100]">
        <div className="modal-card max-w-md p-8 text-center animate-in fade-in zoom-in duration-200">
          <div className="mb-6">
            <div className="w-16 h-16 bg-brand-soft rounded-full flex items-center justify-center mx-auto mb-4">
              <Spinner size="lg" tone="brand" />
            </div>
            <h2 className="text-xl font-bold text-text">Importing TM...</h2>
            <p className="text-sm text-text-muted mt-1">{progressMessage}</p>
          </div>

          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <span className="badge badge-brand">Progress</span>
              <span className="text-xs font-semibold inline-block text-brand">
                {clampedProgress}%
              </span>
            </div>
            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-brand-soft">
              <div
                style={{ width: `${clampedProgress}%` }}
                className="shadow-none flex flex-col text-center whitespace-nowrap text-brand-contrast justify-center bg-brand transition-all duration-300"
              />
            </div>
            <p className="text-[10px] text-text-faint font-medium">Job ID: {jobId}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop !z-[100]">
      <div className="modal-card max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="panel-header px-8 py-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-text">Import TM from File</h2>
            <p className="text-sm text-text-muted mt-1">Map columns and configure import filters</p>
          </div>
          <IconButton onClick={onClose} tone="neutral" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-muted flex items-center gap-2">
                <span className="w-2 h-2 bg-brand rounded-full"></span>
                Source Text Column (原文)
              </label>
              <Select
                value={sourceCol}
                onChange={(e) => setSourceCol(parseInt(e.target.value, 10))}
                className="!p-2.5"
              >
                {colIndexes.map((i) => (
                  <option key={i} value={i}>
                    Column {XLSX_COL_NAME(i)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-text-muted flex items-center gap-2">
                <span className="w-2 h-2 bg-success rounded-full"></span>
                Target Text Column (译文)
              </label>
              <Select
                value={targetCol}
                onChange={(e) => setTargetCol(parseInt(e.target.value, 10))}
                className="!p-2.5"
              >
                {colIndexes.map((i) => (
                  <option key={i} value={i}>
                    Column {XLSX_COL_NAME(i)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card
              variant="subtle"
              className="flex items-center gap-3 p-4 border-brand/20 bg-brand-soft/50"
            >
              <input
                type="checkbox"
                id="hasHeader"
                checked={hasHeader}
                onChange={(e) => setHasHeader(e.target.checked)}
                className="w-4 h-4 accent-brand"
              />
              <label
                htmlFor="hasHeader"
                className="text-sm font-medium text-text-muted cursor-pointer select-none"
              >
                First row is a header (Skip it)
              </label>
            </Card>

            <Card
              variant="subtle"
              className="flex items-center gap-3 p-4 border-info/20 bg-info-soft/50"
            >
              <input
                type="checkbox"
                id="overwrite"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
                className="w-4 h-4 accent-info"
              />
              <label
                htmlFor="overwrite"
                className="text-sm font-medium text-text-muted cursor-pointer select-none"
              >
                Overwrite existing entries
              </label>
            </Card>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-text-faint uppercase tracking-wider">
              Preview & Filtering
            </h3>
            <p className="text-[11px] text-text-muted italic mb-2">
              Note: Empty source/target rows will be filtered out automatically.
            </p>
            <Card variant="surface" className="table-shell !rounded-xl !shadow-sm">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="table-head">
                  <tr>
                    {colIndexes.map((i) => (
                      <th
                        key={i}
                        className={`px-4 py-3 font-bold text-[11px] uppercase tracking-tight ${
                          i === sourceCol
                            ? 'text-brand bg-brand-soft/50'
                            : i === targetCol
                              ? 'text-success bg-success-soft/50'
                              : 'text-text-muted'
                        }`}
                      >
                        Col {XLSX_COL_NAME(i)}
                        {i === sourceCol && <span className="block text-[9px] mt-0.5">Source</span>}
                        {i === targetCol && <span className="block text-[9px] mt-0.5">Target</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {previewData.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className={`${hasHeader && rowIndex === 0 ? 'bg-muted/80 opacity-60 italic' : 'bg-surface'}`}
                    >
                      {colIndexes.map((i) => (
                        <td
                          key={i}
                          className={`px-4 py-3 truncate max-w-[200px] text-xs ${
                            i === sourceCol
                              ? 'bg-brand-soft/20 font-medium'
                              : i === targetCol
                                ? 'bg-success-soft/20'
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
            </Card>
          </div>
        </div>

        <div className="panel-footer px-8 py-6 flex justify-end gap-3">
          <Button onClick={onClose} variant="secondary" size="lg">
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm({ hasHeader, sourceCol, targetCol, overwrite });
            }}
            variant="primary"
            size="lg"
            className="!px-8 shadow-md shadow-brand/20 transition-all hover:-translate-y-0.5"
          >
            Start Import
          </Button>
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
