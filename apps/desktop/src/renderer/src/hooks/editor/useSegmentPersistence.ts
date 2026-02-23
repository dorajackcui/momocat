import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Segment, SegmentStatus, Token } from '@cat/core';
import { apiClient } from '../../services/apiClient';

interface PersistSegmentUpdateInput {
  segmentId: string;
  targetTokens: Token[];
  status: SegmentStatus;
  previousSegment: Segment;
}

interface SegmentPersistorDeps {
  updateSegment: (segmentId: string, targetTokens: Token[], status: SegmentStatus) => Promise<unknown>;
  rollbackSegment: (segmentId: string, previousSegment: Segment) => void;
  setSegmentSaveError: (segmentId: string, message: string) => void;
  clearSegmentSaveError: (segmentId: string) => void;
}

interface SegmentPersistor {
  persistSegmentUpdate: (input: PersistSegmentUpdateInput) => Promise<void>;
  clear: () => void;
}

export function createSegmentPersistor(deps: SegmentPersistorDeps): SegmentPersistor {
  const latestRequestVersionBySegment = new Map<string, number>();

  return {
    persistSegmentUpdate: async ({ segmentId, targetTokens, status, previousSegment }) => {
      const nextVersion = (latestRequestVersionBySegment.get(segmentId) ?? 0) + 1;
      latestRequestVersionBySegment.set(segmentId, nextVersion);
      deps.clearSegmentSaveError(segmentId);

      try {
        await deps.updateSegment(segmentId, targetTokens, status);
        if (latestRequestVersionBySegment.get(segmentId) !== nextVersion) {
          return;
        }
        deps.clearSegmentSaveError(segmentId);
      } catch (error) {
        if (latestRequestVersionBySegment.get(segmentId) !== nextVersion) {
          return;
        }
        deps.rollbackSegment(segmentId, previousSegment);
        const message = error instanceof Error ? error.message : String(error);
        deps.setSegmentSaveError(segmentId, `保存失败：${message}`);
      }
    },
    clear: () => {
      latestRequestVersionBySegment.clear();
    },
  };
}

interface UseSegmentPersistenceParams {
  setSegments: Dispatch<SetStateAction<Segment[]>>;
  setSegmentSaveError: (segmentId: string, message: string) => void;
  clearSegmentSaveError: (segmentId: string) => void;
}

export function useSegmentPersistence({
  setSegments,
  setSegmentSaveError,
  clearSegmentSaveError,
}: UseSegmentPersistenceParams) {
  const rollbackSegment = useCallback(
    (segmentId: string, previousSegment: Segment) => {
      setSegments((prev) =>
        prev.map((segment) => {
          if (segment.segmentId !== segmentId) return segment;
          return { ...previousSegment };
        }),
      );
    },
    [setSegments],
  );

  const persistor = useMemo(
    () =>
      createSegmentPersistor({
        updateSegment: (segmentId, targetTokens, status) =>
          apiClient.updateSegment(segmentId, targetTokens, status),
        rollbackSegment,
        setSegmentSaveError,
        clearSegmentSaveError,
      }),
    [clearSegmentSaveError, rollbackSegment, setSegmentSaveError],
  );

  const applyOptimisticSegmentUpdate = useCallback(
    (segmentId: string, updater: (segment: Segment) => Segment) => {
      const snapshot: {
        previousSegment?: Segment;
        nextSegment?: Segment;
      } = {};

      setSegments((prev) =>
        prev.map((segment): Segment => {
          if (segment.segmentId !== segmentId) return segment;
          snapshot.previousSegment = segment;
          snapshot.nextSegment = updater(segment);
          return snapshot.nextSegment;
        }),
      );

      const previousSegment = snapshot.previousSegment;
      const nextSegment = snapshot.nextSegment;
      if (!previousSegment || !nextSegment) {
        return;
      }

      void persistor.persistSegmentUpdate({
        segmentId,
        targetTokens: nextSegment.targetTokens,
        status: nextSegment.status,
        previousSegment,
      });
    },
    [persistor, setSegments],
  );

  return {
    applyOptimisticSegmentUpdate,
    clearPersistQueue: persistor.clear,
  };
}
