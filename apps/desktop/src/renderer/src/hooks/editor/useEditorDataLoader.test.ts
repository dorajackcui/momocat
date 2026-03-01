import { describe, expect, it, vi } from 'vitest';
import type { SegmentsUpdatedEvent } from '../../../../shared/ipc';
import {
  drainQueuedSegmentsUpdatedEvents,
  handleIncomingSegmentsUpdatedEvent,
} from './useEditorDataLoader';

vi.mock('../../services/apiClient', () => ({
  apiClient: {},
}));

function createEvent(segmentId: string, clientRequestId?: string): SegmentsUpdatedEvent {
  return {
    segmentId,
    targetTokens: [{ type: 'text', content: `target-${segmentId}` }],
    status: 'draft',
    propagatedIds: [],
    clientRequestId,
    serverAppliedAt: '2026-02-27T00:00:00.000Z',
  };
}

describe('useEditorDataLoader remote update queue helpers', () => {
  it('applies incoming remote update immediately when not stale and not delayed', () => {
    const queuedRemoteUpdates = new Map<string, SegmentsUpdatedEvent>();
    const applySegmentsUpdatedEvent = vi.fn();
    const event = createEvent('seg-1', 'req-1');

    const result = handleIncomingSegmentsUpdatedEvent(event, {
      queuedRemoteUpdates,
      shouldDelayRemoteUpdate: () => false,
      isRemoteUpdateStale: () => false,
      applySegmentsUpdatedEvent,
    });

    expect(result).toBe('applied');
    expect(applySegmentsUpdatedEvent).toHaveBeenCalledWith(event);
    expect(queuedRemoteUpdates.size).toBe(0);
  });

  it('queues incoming remote update when delay gate is active', () => {
    const queuedRemoteUpdates = new Map<string, SegmentsUpdatedEvent>();
    const applySegmentsUpdatedEvent = vi.fn();
    const event = createEvent('seg-2', 'req-2');

    const result = handleIncomingSegmentsUpdatedEvent(event, {
      queuedRemoteUpdates,
      shouldDelayRemoteUpdate: () => true,
      isRemoteUpdateStale: () => false,
      applySegmentsUpdatedEvent,
    });

    expect(result).toBe('queued');
    expect(applySegmentsUpdatedEvent).not.toHaveBeenCalled();
    expect(queuedRemoteUpdates.get('seg-2')).toEqual(event);
  });

  it('drops stale incoming remote update', () => {
    const queuedRemoteUpdates = new Map<string, SegmentsUpdatedEvent>();
    const applySegmentsUpdatedEvent = vi.fn();
    const event = createEvent('seg-3', 'req-3');

    const result = handleIncomingSegmentsUpdatedEvent(event, {
      queuedRemoteUpdates,
      shouldDelayRemoteUpdate: () => false,
      isRemoteUpdateStale: () => true,
      applySegmentsUpdatedEvent,
    });

    expect(result).toBe('stale');
    expect(applySegmentsUpdatedEvent).not.toHaveBeenCalled();
    expect(queuedRemoteUpdates.size).toBe(0);
  });

  it('drains queued updates when gate opens and keeps delayed ones queued', () => {
    const queuedRemoteUpdates = new Map<string, SegmentsUpdatedEvent>([
      ['seg-open', createEvent('seg-open', 'req-open')],
      ['seg-delay', createEvent('seg-delay', 'req-delay')],
      ['seg-stale', createEvent('seg-stale', 'req-stale')],
    ]);
    const applySegmentsUpdatedEvent = vi.fn();

    const result = drainQueuedSegmentsUpdatedEvents({
      queuedRemoteUpdates,
      shouldDelayRemoteUpdate: (segmentId) => segmentId === 'seg-delay',
      isRemoteUpdateStale: (segmentId) => segmentId === 'seg-stale',
      applySegmentsUpdatedEvent,
    });

    expect(result).toEqual({ appliedCount: 1, droppedStaleCount: 1 });
    expect(applySegmentsUpdatedEvent).toHaveBeenCalledTimes(1);
    expect(applySegmentsUpdatedEvent).toHaveBeenCalledWith(createEvent('seg-open', 'req-open'));
    expect(queuedRemoteUpdates.has('seg-open')).toBe(false);
    expect(queuedRemoteUpdates.has('seg-stale')).toBe(false);
    expect(queuedRemoteUpdates.has('seg-delay')).toBe(true);
  });
});
