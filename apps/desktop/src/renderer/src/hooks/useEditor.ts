import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DEFAULT_PROJECT_QA_SETTINGS,
  Segment,
  SegmentStatus,
  TBMatch,
  SegmentQaRuleId,
  Token,
  evaluateSegmentQa,
  parseEditorTextToTokens,
  serializeTokensToDisplayText,
  serializeTokensToEditorText,
  TagValidator,
} from '@cat/core';
import { apiClient } from '../services/apiClient';
import type { TMMatch } from '../../../shared/ipc';

interface UseEditorProps {
  activeFileId: number | null;
}

interface PersistSegmentUpdateInput {
  segmentId: string;
  targetTokens: Token[];
  status: SegmentStatus;
  previousSegment: Segment;
}

interface SegmentPersistorDeps {
  updateSegment: (
    segmentId: string,
    targetTokens: Token[],
    status: SegmentStatus,
  ) => Promise<unknown>;
  rollbackSegment: (segmentId: string, previousSegment: Segment) => void;
  setSegmentSaveError: (segmentId: string, message: string) => void;
  clearSegmentSaveError: (segmentId: string) => void;
}

interface SegmentPersistor {
  persistSegmentUpdate: (input: PersistSegmentUpdateInput) => Promise<void>;
  clear: () => void;
}

const VALID_SEGMENT_STATUSES: Set<SegmentStatus> = new Set([
  'new',
  'draft',
  'translated',
  'confirmed',
  'reviewed',
]);

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

export function useEditor({ activeFileId }: UseEditorProps) {
  const SEGMENT_PAGE_SIZE = 1000;
  const MATCH_REQUEST_DEBOUNCE_MS = 150;
  const [segments, setSegments] = useState<Segment[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [enabledQaRuleIds, setEnabledQaRuleIds] = useState<SegmentQaRuleId[]>(
    DEFAULT_PROJECT_QA_SETTINGS.enabledRuleIds,
  );
  const [instantQaOnConfirm, setInstantQaOnConfirm] = useState<boolean>(
    DEFAULT_PROJECT_QA_SETTINGS.instantQaOnConfirm,
  );
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [activeMatches, setActiveMatches] = useState<TMMatch[]>([]);
  const [activeTerms, setActiveTerms] = useState<TBMatch[]>([]);
  const [segmentSaveErrors, setSegmentSaveErrors] = useState<Record<string, string>>({});
  const [aiTranslatingSegmentIds, setAiTranslatingSegmentIds] = useState<Record<string, boolean>>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const tagValidator = new TagValidator();
  const matchRequestSeqRef = useRef(0);
  const termRequestSeqRef = useRef(0);
  const segmentPersistorRef = useRef<SegmentPersistor | null>(null);

  const isTokenLike = useCallback((value: unknown): value is Token => {
    if (!value || typeof value !== 'object') return false;
    const tokenCandidate = value as { type?: unknown; content?: unknown };
    return typeof tokenCandidate.type === 'string' && typeof tokenCandidate.content === 'string';
  }, []);

  const normalizeTokens = useCallback(
    (tokens: unknown, context: string): Token[] => {
      if (!Array.isArray(tokens)) {
        console.warn(`[useEditor] ${context} tokens not array`, tokens);
        return [];
      }
      const cleaned = tokens.filter(isTokenLike);
      if (cleaned.length !== tokens.length) {
        console.warn(`[useEditor] ${context} tokens contained invalid entries`, tokens);
      }
      return cleaned;
    },
    [isTokenLike],
  );

  const normalizeStatus = useCallback((status: unknown, targetTokens: Token[]): SegmentStatus => {
    if (typeof status === 'string' && VALID_SEGMENT_STATUSES.has(status as SegmentStatus)) {
      return status as SegmentStatus;
    }
    const hasTargetContent = targetTokens.some((token) => token.content.trim().length > 0);
    return hasTargetContent ? 'draft' : 'new';
  }, []);

  const setSegmentSaveError = useCallback((segmentId: string, message: string) => {
    setSegmentSaveErrors((prev) => {
      if (prev[segmentId] === message) return prev;
      return {
        ...prev,
        [segmentId]: message,
      };
    });
  }, []);

  const clearSegmentSaveError = useCallback((segmentId: string) => {
    setSegmentSaveErrors((prev) => {
      if (!prev[segmentId]) return prev;
      const next = { ...prev };
      delete next[segmentId];
      return next;
    });
  }, []);

  const rollbackSegment = useCallback((segmentId: string, previousSegment: Segment) => {
    setSegments((prev) =>
      prev.map((seg) => {
        if (seg.segmentId !== segmentId) return seg;
        return {
          ...previousSegment,
        };
      }),
    );
  }, []);

  if (!segmentPersistorRef.current) {
    segmentPersistorRef.current = createSegmentPersistor({
      updateSegment: (segmentId, targetTokens, status) =>
        apiClient.updateSegment(segmentId, targetTokens, status),
      rollbackSegment,
      setSegmentSaveError,
      clearSegmentSaveError,
    });
  }

  // Load Segments & Project Info
  const loadEditorData = useCallback(async () => {
    if (activeFileId === null) {
      setSegments([]);
      setProjectId(null);
      setEnabledQaRuleIds(DEFAULT_PROJECT_QA_SETTINGS.enabledRuleIds);
      setInstantQaOnConfirm(DEFAULT_PROJECT_QA_SETTINGS.instantQaOnConfirm);
      setSegmentSaveErrors({});
      setAiTranslatingSegmentIds({});
      segmentPersistorRef.current?.clear();
      return;
    }

    setLoading(true);
    try {
      // Get file to find projectId
      const file = await apiClient.getFile(activeFileId);
      if (file) {
        setProjectId(file.projectId);
        const project = await apiClient.getProject(file.projectId);
        const qaSettings = project?.qaSettings || DEFAULT_PROJECT_QA_SETTINGS;
        setEnabledQaRuleIds(
          qaSettings.enabledRuleIds || DEFAULT_PROJECT_QA_SETTINGS.enabledRuleIds,
        );
        setInstantQaOnConfirm(
          typeof qaSettings.instantQaOnConfirm === 'boolean'
            ? qaSettings.instantQaOnConfirm
            : DEFAULT_PROJECT_QA_SETTINGS.instantQaOnConfirm,
        );
      }

      const segmentsArray: Segment[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const page = await apiClient.getSegments(activeFileId, offset, SEGMENT_PAGE_SIZE);
        const pageArray = Array.isArray(page) ? page : [];
        if (pageArray.length === 0) break;
        segmentsArray.push(...pageArray);
        hasMore = pageArray.length === SEGMENT_PAGE_SIZE;
        offset += SEGMENT_PAGE_SIZE;
      }

      const normalized = segmentsArray.map((seg) => {
        const sourceTokens = normalizeTokens(seg.sourceTokens, `segment ${seg.segmentId} source`);
        const targetTokens = normalizeTokens(seg.targetTokens, `segment ${seg.segmentId} target`);
        return {
          ...seg,
          sourceTokens,
          targetTokens,
          status: normalizeStatus(seg.status, targetTokens),
          autoFixSuggestions: undefined,
        };
      });
      setSegments(normalized);
      setSegmentSaveErrors({});
      setAiTranslatingSegmentIds({});
      segmentPersistorRef.current?.clear();
      setActiveSegmentId((prev) => {
        if (prev && normalized.some((seg) => seg.segmentId === prev)) return prev;
        return normalized.length > 0 ? normalized[0].segmentId : null;
      });
    } catch (error) {
      console.error('Failed to load editor data:', error);
    } finally {
      setLoading(false);
    }
  }, [activeFileId, normalizeStatus, normalizeTokens]);

  useEffect(() => {
    loadEditorData();
  }, [loadEditorData]);

  // Listen for real-time updates from backend (Propagation, etc.)
  useEffect(() => {
    const unsubscribe = apiClient.onSegmentsUpdated((data) => {
      setSegmentSaveErrors((prev) => {
        let changed = false;
        const next = { ...prev };
        if (next[data.segmentId]) {
          delete next[data.segmentId];
          changed = true;
        }
        for (const propagatedId of data.propagatedIds ?? []) {
          if (next[propagatedId]) {
            delete next[propagatedId];
            changed = true;
          }
        }
        return changed ? next : prev;
      });

      setSegments((prev) => {
        let changed = false;
        const newSegments: Segment[] = prev.map((seg): Segment => {
          // 1. Is it the directly updated segment?
          if (seg.segmentId === data.segmentId) {
            changed = true;
            const targetTokens = normalizeTokens(
              data.targetTokens,
              `segment ${seg.segmentId} target (update)`,
            );
            const nextStatus = normalizeStatus(data.status, targetTokens);
            return {
              ...seg,
              targetTokens,
              status: nextStatus,
              qaIssues: nextStatus === 'confirmed' ? seg.qaIssues : undefined,
              autoFixSuggestions: nextStatus === 'confirmed' ? seg.autoFixSuggestions : undefined,
            };
          }
          // 2. Is it a propagated segment?
          if (data.propagatedIds?.includes(seg.segmentId)) {
            changed = true;
            const targetTokens = normalizeTokens(
              data.targetTokens,
              `segment ${seg.segmentId} target (propagation)`,
            );
            return {
              ...seg,
              targetTokens,
              status: 'draft' as SegmentStatus,
              qaIssues: undefined,
              autoFixSuggestions: undefined,
            };
          }
          return seg;
        });
        return changed ? newSegments : prev;
      });
    });

    return () => unsubscribe();
  }, [normalizeStatus, normalizeTokens]);

  // Load TM Match for active segment
  useEffect(() => {
    if (!activeSegmentId || projectId === null) {
      matchRequestSeqRef.current += 1;
      setActiveMatches([]);
      return;
    }

    const segment = segments.find((s) => s.segmentId === activeSegmentId);
    if (!segment) {
      matchRequestSeqRef.current += 1;
      setActiveMatches([]);
      return;
    }

    let cancelled = false;
    const requestSeq = ++matchRequestSeqRef.current;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const matches = await apiClient.getMatches(projectId, segment);
          if (cancelled || requestSeq !== matchRequestSeqRef.current) return;
          setActiveMatches(matches || []);
        } catch (error) {
          if (cancelled || requestSeq !== matchRequestSeqRef.current) return;
          console.error('[useEditor] Failed to load TM matches:', error);
          setActiveMatches([]);
        }
      })();
    }, MATCH_REQUEST_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeSegmentId, segments, projectId]);

  // Load TB matches for active segment
  useEffect(() => {
    if (!activeSegmentId || projectId === null) {
      termRequestSeqRef.current += 1;
      setActiveTerms([]);
      return;
    }

    const segment = segments.find((s) => s.segmentId === activeSegmentId);
    if (!segment) {
      termRequestSeqRef.current += 1;
      setActiveTerms([]);
      return;
    }

    let cancelled = false;
    const requestSeq = ++termRequestSeqRef.current;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const terms = await apiClient.getTermMatches(projectId, segment);
          if (cancelled || requestSeq !== termRequestSeqRef.current) return;
          setActiveTerms(terms || []);
        } catch (error) {
          if (cancelled || requestSeq !== termRequestSeqRef.current) return;
          console.error('[useEditor] Failed to load TB matches:', error);
          setActiveTerms([]);
        }
      })();
    }, MATCH_REQUEST_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeSegmentId, segments, projectId]);

  // Actions
  const applyOptimisticSegmentUpdate = useCallback(
    (segmentId: string, updater: (segment: Segment) => Segment) => {
      const snapshot: {
        previousSegment?: Segment;
        nextSegment?: Segment;
      } = {};

      setSegments((prev) =>
        prev.map((seg): Segment => {
          if (seg.segmentId !== segmentId) return seg;
          snapshot.previousSegment = seg;
          snapshot.nextSegment = updater(seg);
          return snapshot.nextSegment;
        }),
      );

      const previousSegment = snapshot.previousSegment;
      const nextSegment = snapshot.nextSegment;
      if (!previousSegment || !nextSegment) {
        return;
      }

      void segmentPersistorRef.current?.persistSegmentUpdate({
        segmentId,
        targetTokens: nextSegment.targetTokens,
        status: nextSegment.status,
        previousSegment,
      });
    },
    [],
  );

  const handleTranslationChange = (segmentId: string, text: string) => {
    try {
      applyOptimisticSegmentUpdate(segmentId, (seg) => {
        const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const tokens = parseEditorTextToTokens(normalizedText, seg.sourceTokens);
        const nextStatus: SegmentStatus = normalizedText.trim() ? 'draft' : 'new';
        return {
          ...seg,
          targetTokens: tokens,
          status: nextStatus,
          qaIssues: undefined,
          autoFixSuggestions: undefined,
        };
      });
    } catch (error) {
      console.error('Error in handleTranslationChange:', error);
      console.error('Segment ID:', segmentId);
      console.error('Text:', text);
    }
  };

  const handleApplyMatch = (tokens: Token[]) => {
    if (!activeSegmentId) return;

    applyOptimisticSegmentUpdate(activeSegmentId, (seg) => ({
      ...seg,
      targetTokens: tokens,
      status: 'draft',
      qaIssues: undefined,
      autoFixSuggestions: undefined,
    }));
  };

  const shouldInsertSpace = (current: string, term: string): boolean => {
    const left = current.slice(-1);
    const right = term.slice(0, 1);
    if (!left || !right) return false;
    return /[A-Za-z0-9]$/.test(left) && /^[A-Za-z0-9]/.test(right);
  };

  const handleApplyTerm = (term: string) => {
    if (!activeSegmentId) return;

    applyOptimisticSegmentUpdate(activeSegmentId, (seg) => {
      const currentText = serializeTokensToEditorText(seg.targetTokens, seg.sourceTokens)
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
      const spacer = shouldInsertSpace(currentText, term) ? ' ' : '';
      const nextText = `${currentText}${spacer}${term}`;
      const nextTokens = parseEditorTextToTokens(nextText, seg.sourceTokens);
      const nextStatus: SegmentStatus = nextText.trim() ? 'draft' : 'new';

      return {
        ...seg,
        targetTokens: nextTokens,
        status: nextStatus,
        qaIssues: undefined,
        autoFixSuggestions: undefined,
      };
    });
  };

  const confirmSegment = async (segmentId: string) => {
    const segment = segments.find((s) => s.segmentId === segmentId);
    if (!segment) return;

    if (instantQaOnConfirm) {
      let termMatches: TBMatch[] = [];
      if (projectId !== null && enabledQaRuleIds.includes('terminology-consistency')) {
        try {
          termMatches = (await apiClient.getTermMatches(projectId, segment)) || [];
        } catch (error) {
          console.error('[useEditor] Failed to run TB QA check:', error);
        }
      }

      const combinedIssues = evaluateSegmentQa(segment, {
        enabledRuleIds: enabledQaRuleIds,
        termMatches,
      });
      const hasBlockingErrors = combinedIssues.some((issue) => issue.severity === 'error');
      const tagValidationResult = enabledQaRuleIds.includes('tag-integrity')
        ? tagValidator.validate(segment.sourceTokens, segment.targetTokens)
        : { issues: [], suggestions: [] };

      setSegments((prev) =>
        prev.map((seg) => {
          if (seg.segmentId !== segmentId) return seg;
          return {
            ...seg,
            qaIssues: combinedIssues,
            autoFixSuggestions: tagValidationResult.suggestions,
          };
        }),
      );

      if (hasBlockingErrors) {
        return;
      }
    } else {
      setSegments((prev) =>
        prev.map((seg) =>
          seg.segmentId === segmentId
            ? { ...seg, qaIssues: undefined, autoFixSuggestions: undefined }
            : seg,
        ),
      );
    }

    // We don't need to manually update state here anymore because the listener will handle it!
    await apiClient.updateSegment(segmentId, segment.targetTokens, 'confirmed');

    // Jump to next
    const currentIndex = segments.findIndex((s) => s.segmentId === segmentId);
    if (currentIndex < segments.length - 1) {
      setActiveSegmentId(segments[currentIndex + 1].segmentId);
    }
  };

  const getActiveSegment = () => segments.find((s) => s.segmentId === activeSegmentId);

  const translateSegmentWithAI = useCallback(
    async (segmentId: string) => {
      if (aiTranslatingSegmentIds[segmentId]) {
        return;
      }

      const segment = segments.find((item) => item.segmentId === segmentId);
      if (!segment) return;

      const sourceText = serializeTokensToDisplayText(segment.sourceTokens).trim();
      if (!sourceText) {
        setSegmentSaveError(segmentId, 'AI 翻译失败：源文为空');
        return;
      }

      setAiTranslatingSegmentIds((prev) => {
        if (prev[segmentId]) return prev;
        return {
          ...prev,
          [segmentId]: true,
        };
      });
      clearSegmentSaveError(segmentId);

      try {
        await apiClient.aiTranslateSegment(segmentId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setSegmentSaveError(segmentId, `AI 翻译失败：${message}`);
      } finally {
        setAiTranslatingSegmentIds((prev) => {
          if (!prev[segmentId]) return prev;
          const next = { ...prev };
          delete next[segmentId];
          return next;
        });
      }
    },
    [aiTranslatingSegmentIds, clearSegmentSaveError, segments, setSegmentSaveError],
  );

  return {
    segments,
    projectId,
    activeSegmentId,
    activeMatches,
    activeTerms,
    segmentSaveErrors,
    setActiveSegmentId,
    loading,
    aiTranslatingSegmentIds,
    handleTranslationChange,
    translateSegmentWithAI,
    confirmSegment,
    handleApplyMatch,
    handleApplyTerm,
    getActiveSegment,
  };
}
