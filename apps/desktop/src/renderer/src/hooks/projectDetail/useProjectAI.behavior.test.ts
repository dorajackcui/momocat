import { describe, expect, it, vi } from 'vitest';
import {
  buildAIStartConfirmMessage,
  resolveAITranslateStartConfig,
} from './ai/useProjectAIController';
import { upsertTrackedJobFromProgress, upsertTrackedJobOnStart } from './ai/aiJobTracker';

vi.mock('../../services/apiClient', () => ({
  apiClient: {},
}));

vi.mock('../../services/feedbackService', () => ({
  feedbackService: {},
}));

describe('useProjectAI controller behaviors', () => {
  it('resolves translation mode and scope for translation projects', () => {
    const config = resolveAITranslateStartConfig({
      projectType: 'translation',
      options: { mode: 'dialogue', targetScope: 'overwrite-non-confirmed' },
    });

    expect(config).toEqual({
      effectiveMode: 'dialogue',
      effectiveTargetScope: 'overwrite-non-confirmed',
      actionLabel: 'dialogue translation',
      targetLabel: 'target',
    });
  });

  it('forces default mode and blank-only scope for non-translation projects', () => {
    const reviewConfig = resolveAITranslateStartConfig({
      projectType: 'review',
      options: { mode: 'dialogue', targetScope: 'overwrite-non-confirmed' },
    });
    const customConfig = resolveAITranslateStartConfig({
      projectType: 'custom',
      options: { mode: 'default', targetScope: 'blank-only' },
    });

    expect(reviewConfig).toMatchObject({
      effectiveMode: 'default',
      effectiveTargetScope: 'blank-only',
      actionLabel: 'review',
      targetLabel: 'target',
    });
    expect(customConfig).toMatchObject({
      effectiveMode: 'default',
      effectiveTargetScope: 'blank-only',
      actionLabel: 'processing',
      targetLabel: 'output',
    });
  });

  it('builds confirmation message with proper scope wording', () => {
    const message = buildAIStartConfirmMessage('demo.xlsx', {
      effectiveMode: 'dialogue',
      effectiveTargetScope: 'overwrite-non-confirmed',
      actionLabel: 'dialogue translation',
      targetLabel: 'target',
    });

    expect(message).toBe(
      'Run AI dialogue translation for "demo.xlsx"? This will overwrite existing non-confirmed target segments.',
    );
  });

  it('keeps terminal status during start/progress race', () => {
    const started = upsertTrackedJobOnStart('job-race', 10);
    const completed = upsertTrackedJobFromProgress(
      {
        jobId: 'job-race',
        progress: 100,
        status: 'completed',
        message: 'Done',
      },
      started,
    );

    const lateStart = upsertTrackedJobOnStart('job-race', 10, completed);

    expect(lateStart).toEqual({
      jobId: 'job-race',
      fileId: 10,
      progress: 100,
      status: 'completed',
      message: 'Done',
    });
  });
});
