import { useState, useEffect, useCallback, useRef } from 'react';
import { Segment, SegmentStatus, TBMatch, Token, parseEditorTextToTokens, serializeTokensToEditorText, TagValidator } from '@cat/core';
import { apiClient } from '../services/apiClient';
import type { TMMatch } from '../../../shared/ipc';

interface UseEditorProps {
  activeFileId: number | null;
}

export function useEditor({ activeFileId }: UseEditorProps) {
  const SEGMENT_PAGE_SIZE = 1000;
  const MATCH_REQUEST_DEBOUNCE_MS = 150;
  const [segments, setSegments] = useState<Segment[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [activeMatches, setActiveMatches] = useState<TMMatch[]>([]);
  const [activeTerms, setActiveTerms] = useState<TBMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const tagValidator = new TagValidator();
  const matchRequestSeqRef = useRef(0);
  const termRequestSeqRef = useRef(0);

  const isTokenLike = (value: unknown): value is Token => {
    if (!value || typeof value !== 'object') return false;
    const tokenCandidate = value as { type?: unknown; content?: unknown };
    return typeof tokenCandidate.type === 'string' && typeof tokenCandidate.content === 'string';
  };

  const normalizeTokens = (tokens: unknown, context: string): Token[] => {
    if (!Array.isArray(tokens)) {
      console.warn(`[useEditor] ${context} tokens not array`, tokens);
      return [];
    }
    const cleaned = tokens.filter(isTokenLike);
    if (cleaned.length !== tokens.length) {
      console.warn(`[useEditor] ${context} tokens contained invalid entries`, tokens);
    }
    return cleaned;
  };

  // Load Segments & Project Info
  const loadEditorData = useCallback(async () => {
    if (activeFileId === null) {
      setSegments([]);
      setProjectId(null);
      return;
    }

    setLoading(true);
    try {
      // Get file to find projectId
      const file = await apiClient.getFile(activeFileId);
      if (file) {
        setProjectId(file.projectId);
      }

      const segmentsArray: Segment[] = [];
      let offset = 0;
      while (true) {
        const page = await apiClient.getSegments(activeFileId, offset, SEGMENT_PAGE_SIZE);
        const pageArray = Array.isArray(page) ? page : [];
        if (pageArray.length === 0) break;
        segmentsArray.push(...pageArray);
        if (pageArray.length < SEGMENT_PAGE_SIZE) break;
        offset += SEGMENT_PAGE_SIZE;
      }

      const normalized = segmentsArray.map((seg) => ({
        ...seg,
        sourceTokens: normalizeTokens(seg.sourceTokens, `segment ${seg.segmentId} source`),
        targetTokens: normalizeTokens(seg.targetTokens, `segment ${seg.segmentId} target`),
        qaIssues: undefined,
        autoFixSuggestions: undefined
      }));
      setSegments(normalized);
      setActiveSegmentId((prev) => {
        if (prev && normalized.some((seg) => seg.segmentId === prev)) return prev;
        return normalized.length > 0 ? normalized[0].segmentId : null;
      });
    } catch (error) {
      console.error('Failed to load editor data:', error);
    } finally {
      setLoading(false);
    }
  }, [activeFileId]);

  useEffect(() => {
    loadEditorData();
  }, [loadEditorData]);

  // Listen for real-time updates from backend (Propagation, etc.)
  useEffect(() => {
    const unsubscribe = apiClient.onSegmentsUpdated((data) => {
      setSegments(prev => {
        let changed = false;
        const newSegments: Segment[] = prev.map((seg): Segment => {
          // 1. Is it the directly updated segment?
          if (seg.segmentId === data.segmentId) {
            changed = true;
            const targetTokens = normalizeTokens(data.targetTokens, `segment ${seg.segmentId} target (update)`);
            const nextStatus: SegmentStatus = data.status;
            return { 
              ...seg, 
              targetTokens,
              status: nextStatus,
              qaIssues: nextStatus === 'confirmed' ? seg.qaIssues : undefined,
              autoFixSuggestions: nextStatus === 'confirmed' ? seg.autoFixSuggestions : undefined
            };
          }
          // 2. Is it a propagated segment?
          if (data.propagatedIds?.includes(seg.segmentId)) {
            changed = true;
            const targetTokens = normalizeTokens(data.targetTokens, `segment ${seg.segmentId} target (propagation)`);
            return { 
              ...seg, 
              targetTokens,
              status: 'draft' as SegmentStatus,
              qaIssues: undefined,
              autoFixSuggestions: undefined
            };
          }
          return seg;
        });
        return changed ? newSegments : prev;
      });
    });

    return () => unsubscribe();
  }, []);

  // Load TM Match for active segment
  useEffect(() => {
    if (!activeSegmentId || projectId === null) {
      matchRequestSeqRef.current += 1;
      setActiveMatches([]);
      return;
    }

    const segment = segments.find(s => s.segmentId === activeSegmentId);
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

    const segment = segments.find(s => s.segmentId === activeSegmentId);
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
  const handleTranslationChange = (segmentId: string, text: string) => {
    try {
      setSegments(prev => prev.map((seg): Segment => {
        if (seg.segmentId === segmentId) {
          const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          const tokens = parseEditorTextToTokens(normalizedText, seg.sourceTokens);
          const nextStatus: SegmentStatus = normalizedText.trim() ? 'draft' : 'new';
          
          const updated: Segment = { 
            ...seg, 
            targetTokens: tokens,
            status: nextStatus,
            // Run QA only on confirm to avoid per-keystroke/per-segment compute cost.
            qaIssues: undefined,
            autoFixSuggestions: undefined
          };
          // Async save
          apiClient.updateSegment(segmentId, tokens, nextStatus);
          return updated;
        }
        return seg;
      }));
    } catch (error) {
      console.error('Error in handleTranslationChange:', error);
      console.error('Segment ID:', segmentId);
      console.error('Text:', text);
    }
  };

  const handleApplyMatch = (tokens: Token[]) => {
    if (!activeSegmentId) return;
    
    setSegments(prev => prev.map((seg): Segment => {
      if (seg.segmentId === activeSegmentId) {
        const updated: Segment = { 
          ...seg, 
          targetTokens: tokens,
          status: 'draft',
          qaIssues: undefined,
          autoFixSuggestions: undefined
        };
        apiClient.updateSegment(activeSegmentId, tokens, 'draft');
        return updated;
      }
      return seg;
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

    setSegments(prev => prev.map((seg): Segment => {
      if (seg.segmentId !== activeSegmentId) return seg;

      const currentText = serializeTokensToEditorText(seg.targetTokens, seg.sourceTokens)
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
      const spacer = shouldInsertSpace(currentText, term) ? ' ' : '';
      const nextText = `${currentText}${spacer}${term}`;
      const nextTokens = parseEditorTextToTokens(nextText, seg.sourceTokens);
      const nextStatus: SegmentStatus = nextText.trim() ? 'draft' : 'new';

      apiClient.updateSegment(activeSegmentId, nextTokens, nextStatus);
      return {
        ...seg,
        targetTokens: nextTokens,
        status: nextStatus,
        qaIssues: undefined,
        autoFixSuggestions: undefined
      };
    }));
  };

  const confirmSegment = async (segmentId: string) => {
    const segment = segments.find(s => s.segmentId === segmentId);
    if (!segment) return;

    const validationResult = tagValidator.validate(segment.sourceTokens, segment.targetTokens);
    const hasBlockingErrors = validationResult.issues.some(issue => issue.severity === 'error');

    setSegments(prev => prev.map(seg => {
      if (seg.segmentId !== segmentId) return seg;
      return {
        ...seg,
        qaIssues: validationResult.issues,
        autoFixSuggestions: validationResult.suggestions
      };
    }));

    if (hasBlockingErrors) {
      return;
    }

    // We don't need to manually update state here anymore because the listener will handle it!
    await apiClient.updateSegment(segmentId, segment.targetTokens, 'confirmed');
    
    // Jump to next
    const currentIndex = segments.findIndex(s => s.segmentId === segmentId);
    if (currentIndex < segments.length - 1) {
      setActiveSegmentId(segments[currentIndex + 1].segmentId);
    }
  };

  const getActiveSegment = () => segments.find(s => s.segmentId === activeSegmentId);

  return {
    segments,
    projectId,
    activeSegmentId,
    activeMatches,
    activeTerms,
    setActiveSegmentId,
    loading,
    handleTranslationChange,
    confirmSegment,
    handleApplyMatch,
    handleApplyTerm,
    getActiveSegment,
  };
}
