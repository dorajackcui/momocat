import { describe, expect, it, vi } from 'vitest';
import { Segment } from '@cat/core';

vi.mock('../services/apiClient', () => ({
  apiClient: {},
}));

import { createSegmentPersistor } from './useEditor';

function createSegment(segmentId: string, targetText: string): Segment {
  return {
    segmentId,
    fileId: 1,
    orderIndex: 0,
    sourceTokens: [{ type: 'text', content: 'Hello' }],
    targetTokens: targetText ? [{ type: 'text', content: targetText }] : [],
    status: targetText ? 'draft' : 'new',
    tagsSignature: '',
    matchKey: 'hello',
    srcHash: `hash-${segmentId}`,
    meta: {
      updatedAt: new Date().toISOString(),
    },
  };
}

describe('createSegmentPersistor', () => {
  it('clears error and persists successfully', async () => {
    const updateSegment = vi.fn().mockResolvedValue(undefined);
    const rollbackSegment = vi.fn();
    const setSegmentSaveError = vi.fn();
    const clearSegmentSaveError = vi.fn();
    const persistor = createSegmentPersistor({
      updateSegment,
      rollbackSegment,
      setSegmentSaveError,
      clearSegmentSaveError,
    });

    const previousSegment = createSegment('seg-1', '旧译文');
    const nextTokens = [{ type: 'text' as const, content: '新译文' }];

    await persistor.persistSegmentUpdate({
      segmentId: 'seg-1',
      targetTokens: nextTokens,
      status: 'draft',
      previousSegment,
    });

    expect(updateSegment).toHaveBeenCalledWith('seg-1', nextTokens, 'draft');
    expect(rollbackSegment).not.toHaveBeenCalled();
    expect(setSegmentSaveError).not.toHaveBeenCalled();
    expect(clearSegmentSaveError).toHaveBeenCalledTimes(2);
  });

  it('rolls back and records error on persist failure', async () => {
    const updateSegment = vi.fn().mockRejectedValue(new Error('network down'));
    const rollbackSegment = vi.fn();
    const setSegmentSaveError = vi.fn();
    const clearSegmentSaveError = vi.fn();
    const persistor = createSegmentPersistor({
      updateSegment,
      rollbackSegment,
      setSegmentSaveError,
      clearSegmentSaveError,
    });

    const previousSegment = createSegment('seg-2', '原目标');
    const nextTokens = [{ type: 'text' as const, content: '改后目标' }];

    await persistor.persistSegmentUpdate({
      segmentId: 'seg-2',
      targetTokens: nextTokens,
      status: 'draft',
      previousSegment,
    });

    expect(rollbackSegment).toHaveBeenCalledWith('seg-2', previousSegment);
    expect(setSegmentSaveError).toHaveBeenCalledWith(
      'seg-2',
      expect.stringContaining('network down'),
    );
  });

  it('ignores stale failure when a newer save request succeeds', async () => {
    let rejectOldRequest: ((reason?: unknown) => void) | undefined;
    let resolveNewRequest: (() => void) | undefined;

    const oldRequest = new Promise<void>((_, reject) => {
      rejectOldRequest = reject;
    });
    const newRequest = new Promise<void>((resolve) => {
      resolveNewRequest = resolve;
    });

    const updateSegment = vi
      .fn()
      .mockImplementationOnce(() => oldRequest)
      .mockImplementationOnce(() => newRequest);
    const rollbackSegment = vi.fn();
    const setSegmentSaveError = vi.fn();
    const clearSegmentSaveError = vi.fn();
    const persistor = createSegmentPersistor({
      updateSegment,
      rollbackSegment,
      setSegmentSaveError,
      clearSegmentSaveError,
    });

    const previousSegment = createSegment('seg-3', '旧值');
    const oldCall = persistor.persistSegmentUpdate({
      segmentId: 'seg-3',
      targetTokens: [{ type: 'text', content: 'old' }],
      status: 'draft',
      previousSegment,
    });

    const newCall = persistor.persistSegmentUpdate({
      segmentId: 'seg-3',
      targetTokens: [{ type: 'text', content: 'new' }],
      status: 'draft',
      previousSegment: createSegment('seg-3', 'old'),
    });

    resolveNewRequest?.();
    await newCall;
    rejectOldRequest?.(new Error('stale failure'));
    await oldCall;

    expect(rollbackSegment).not.toHaveBeenCalled();
    expect(setSegmentSaveError).not.toHaveBeenCalled();
  });
});
