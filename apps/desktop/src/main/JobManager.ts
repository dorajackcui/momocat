import { EventEmitter } from 'events';
import type { JobProgressEvent } from '../shared/ipc';

export type JobProgress = JobProgressEvent;

export class JobManager extends EventEmitter {
  private jobs: Map<string, JobProgress> = new Map();

  public startJob(jobId: string, initialMessage?: string): JobProgress {
    const progress: JobProgress = {
      jobId,
      progress: 0,
      status: 'running',
      message: initialMessage,
    };
    this.jobs.set(jobId, progress);
    this.emit('progress', progress);
    return progress;
  }

  public updateProgress(jobId: string, update: Partial<JobProgress>) {
    const job = this.jobs.get(jobId);
    if (job) {
      Object.assign(job, update);
      this.emit('progress', job);
    }
  }

  public getJob(jobId: string): JobProgress | undefined {
    return this.jobs.get(jobId);
  }
}
