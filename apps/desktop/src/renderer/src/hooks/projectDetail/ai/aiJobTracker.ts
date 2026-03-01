import type { JobProgressEvent } from '../../../../../shared/ipc';
import type { TrackedAIJob } from './types';

const TERMINAL_JOB_STATUSES: TrackedAIJob['status'][] = ['completed', 'failed', 'cancelled'];

export function isTerminalJobStatus(status: TrackedAIJob['status']): boolean {
  return TERMINAL_JOB_STATUSES.includes(status);
}

export function upsertTrackedJobFromProgress(
  progress: JobProgressEvent,
  existing?: TrackedAIJob,
): TrackedAIJob {
  const base: TrackedAIJob = existing ?? {
    jobId: progress.jobId,
    fileId: -1,
    progress: 0,
    status: 'running',
    message: undefined,
  };

  return {
    ...base,
    ...progress,
    fileId: base.fileId,
  };
}

export function upsertTrackedJobOnStart(
  jobId: string,
  fileId: number,
  existing?: TrackedAIJob,
): TrackedAIJob {
  if (!existing) {
    return { jobId, fileId, progress: 0, status: 'running', message: 'Queued' };
  }

  if (isTerminalJobStatus(existing.status)) {
    return { ...existing, fileId };
  }

  return {
    ...existing,
    fileId,
    status: existing.status || 'running',
    progress: typeof existing.progress === 'number' ? existing.progress : 0,
    message: existing.message ?? 'Queued',
  };
}
