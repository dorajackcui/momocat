import { useState, useEffect, useCallback } from 'react';
import { Segment, Token, parseEditorTextToTokens, TMEntry, TagValidator } from '@cat/core';

interface UseEditorProps {
  activeFileId: number | null;
}

export function useEditor({ activeFileId }: UseEditorProps) {
  const SEGMENT_PAGE_SIZE = 1000;
  const [segments, setSegments] = useState<Segment[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [activeMatches, setActiveMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const tagValidator = new TagValidator();
  
  const normalizeTokens = (tokens: any, context: string): Token[] => {
    if (!Array.isArray(tokens)) {
      console.warn(`[useEditor] ${context} tokens not array`, tokens);
      return [];
    }
    const cleaned = tokens.filter(
      (t) => t && typeof t.type === 'string' && typeof t.content === 'string'
    );
    if (cleaned.length !== tokens.length) {
      console.warn(`[useEditor] ${context} tokens contained invalid entries`, tokens);
    }
    return cleaned as Token[];
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
      const file = await window.api.getFile(activeFileId);
      if (file) {
        setProjectId(file.projectId);
      }

      const segmentsArray: Segment[] = [];
      let offset = 0;
      while (true) {
        const page = await window.api.getSegments(activeFileId, offset, SEGMENT_PAGE_SIZE);
        const pageArray = Array.isArray(page) ? (page as Segment[]) : [];
        if (pageArray.length === 0) break;
        segmentsArray.push(...pageArray);
        if (pageArray.length < SEGMENT_PAGE_SIZE) break;
        offset += SEGMENT_PAGE_SIZE;
      }

      const normalized = segmentsArray.map((seg) => ({
        ...(seg as Segment),
        sourceTokens: normalizeTokens((seg as Segment).sourceTokens, `segment ${(seg as Segment).segmentId} source`),
        targetTokens: normalizeTokens((seg as Segment).targetTokens, `segment ${(seg as Segment).segmentId} target`),
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
    const unsubscribe = window.api.onSegmentsUpdated((data: any) => {
      setSegments(prev => {
        let changed = false;
        const newSegments = prev.map(seg => {
          // 1. Is it the directly updated segment?
          if (seg.segmentId === data.segmentId) {
            changed = true;
            const targetTokens = normalizeTokens(data.targetTokens, `segment ${seg.segmentId} target (update)`);
            const nextStatus = data.status as any;
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
              status: 'draft' as any,
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
    const loadMatch = async () => {
      if (!activeSegmentId || projectId === null) {
        setActiveMatches([]);
        return;
      }
      const segment = segments.find(s => s.segmentId === activeSegmentId);
      if (segment) {
        const matches = await window.api.getMatches(projectId, segment); 
        setActiveMatches(matches || []);
      }
    };
    loadMatch();
  }, [activeSegmentId, segments, projectId]);

  // Actions
  const handleTranslationChange = (segmentId: string, text: string) => {
    try {
      setSegments(prev => prev.map(seg => {
        if (seg.segmentId === segmentId) {
          const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          const tokens = parseEditorTextToTokens(normalizedText, seg.sourceTokens);
          
          const updated = { 
            ...seg, 
            targetTokens: tokens,
            status: (normalizedText.trim() ? 'draft' : 'new') as any,
            // Run QA only on confirm to avoid per-keystroke/per-segment compute cost.
            qaIssues: undefined,
            autoFixSuggestions: undefined
          };
          // Async save
          window.api.updateSegment(segmentId, tokens, updated.status);
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
    
    setSegments(prev => prev.map(seg => {
      if (seg.segmentId === activeSegmentId) {
        const updated = { 
          ...seg, 
          targetTokens: tokens,
          status: 'draft' as any,
          qaIssues: undefined,
          autoFixSuggestions: undefined
        };
        window.api.updateSegment(activeSegmentId, tokens, updated.status);
        return updated;
      }
      return seg;
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
    await window.api.updateSegment(segmentId, segment.targetTokens, 'confirmed');
    
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
    setActiveSegmentId,
    loading,
    handleTranslationChange,
    confirmSegment,
    handleApplyMatch,
    getActiveSegment,
  };
}
