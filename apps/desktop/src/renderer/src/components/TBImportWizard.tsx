import React, { useEffect, useRef, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { Button, Card, IconButton, Select, Spinner } from './ui';
import type {
  ImportExecutionResult,
  JobProgressEvent,
  SpreadsheetPreviewData,
  StructuredJobError,
  TBImportOptions,
} from '../../../shared/ipc';

interface TBImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: TBImportOptions) => void;
  jobId: string | null;
  onJobCompleted: (result: ImportExecutionResult) => void;
  onJobFailed: (error: StructuredJobError) => void;
  previewData: SpreadsheetPreviewData;
}

export function TBImportWizard({
  isOpen,
  onClose,
  onConfirm,
  jobId,
  onJobCompleted,
  onJobFailed,
  previewData,
}: TBImportWizardProps) {
  const [hasHeader, setHasHeader] = useState(true);
  const [sourceCol, setSourceCol] = useState(0);
  const [targetCol, setTargetCol] = useState(1);
  const [noteCol, setNoteCol] = useState<number | undefined>(2);
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
        if (progress.result?.kind === 'tb-import') {
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
            code: 'TB_IMPORT_FAILED',
            message: progress.message || 'TB import failed',
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
            <div className="w-16 h-16 bg-success-soft rounded-full flex items-center justify-center mx-auto mb-4">
              <Spinner size="lg" tone="success" />
            </div>
            <h2 className="text-xl font-bold text-text">Importing Term Base...</h2>
            <p className="text-sm text-text-muted mt-1">{progressMessage}</p>
          </div>

          <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-success-soft/80">
            <div
              style={{ width: `${clampedProgress}%` }}
              className="shadow-none flex flex-col text-center whitespace-nowrap text-success-contrast justify-center bg-success transition-all duration-300"
            />
          </div>
          <p className="text-[10px] text-text-faint font-medium">Job ID: {jobId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop !z-[100]">
      <div className="modal-card max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="panel-header px-8 py-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-text">Import Terms from File</h2>
            <p className="text-sm text-text-muted mt-1">
              Map source/target columns to build your term base.
            </p>
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
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div>
              <label className="text-sm font-bold text-text-muted">Source Term Column</label>
              <Select
                value={sourceCol}
                onChange={(e) => setSourceCol(parseInt(e.target.value, 10))}
                className="mt-2"
              >
                {colIndexes.map((i) => (
                  <option key={i} value={i}>
                    Column {XLSX_COL_NAME(i)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-bold text-text-muted">Target Term Column</label>
              <Select
                value={targetCol}
                onChange={(e) => setTargetCol(parseInt(e.target.value, 10))}
                className="mt-2"
              >
                {colIndexes.map((i) => (
                  <option key={i} value={i}>
                    Column {XLSX_COL_NAME(i)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-bold text-text-muted">Note Column (Optional)</label>
              <Select
                value={noteCol ?? -1}
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10);
                  setNoteCol(next === -1 ? undefined : next);
                }}
                className="mt-2"
              >
                <option value={-1}>Not used</option>
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
              className="flex items-center gap-3 p-4 border-success/30 bg-success-soft/50"
            >
              <input
                type="checkbox"
                checked={hasHeader}
                onChange={(e) => setHasHeader(e.target.checked)}
                className="w-4 h-4 accent-success"
              />
              <span className="text-sm font-medium text-text-muted">First row is header</span>
            </Card>
            <Card
              variant="subtle"
              className="flex items-center gap-3 p-4 border-brand/20 bg-brand-soft/50"
            >
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
                className="w-4 h-4 accent-brand"
              />
              <span className="text-sm font-medium text-text-muted">
                Overwrite existing source terms
              </span>
            </Card>
          </div>

          <Card variant="surface" className="table-shell !rounded-xl !shadow-sm">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="table-head">
                <tr>
                  {colIndexes.map((i) => (
                    <th
                      key={i}
                      className="px-4 py-3 font-bold text-[11px] uppercase tracking-tight text-text-muted"
                    >
                      Col {XLSX_COL_NAME(i)}
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
                      <td key={i} className="px-4 py-3 truncate max-w-[240px] text-xs">
                        {row[i] || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="panel-footer px-8 py-6 flex justify-end gap-3">
          <Button onClick={onClose} variant="secondary" size="lg">
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm({ hasHeader, sourceCol, targetCol, noteCol, overwrite });
            }}
            variant="primary"
            size="lg"
            className="!px-8"
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
