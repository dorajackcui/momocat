import { useState, useEffect, useCallback } from 'react';
import { Segment, Token, parseEditorTextToTokens, TMEntry, TagValidator } from '@cat/core';

interface UseEditorProps {
  activeFileId: number | null;
}

export function useEditor({ activeFileId }: UseEditorProps) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [activeMatches, setActiveMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const tagValidator = new TagValidator();

  const withQaData = (segment: Segment): Segment => {
    const sourceTokens = normalizeTokens(segment.sourceTokens, `segment ${segment.segmentId} source`);
    const targetTokens = normalizeTokens(segment.targetTokens, `segment ${segment.segmentId} target`);
    const validationResult = tagValidator.validate(sourceTokens, targetTokens);
    return {
      ...segment,
      sourceTokens,
      targetTokens,
      qaIssues: validationResult.issues,
      autoFixSuggestions: validationResult.suggestions
    };
  };
  
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

      const data = await window.api.getSegments(activeFileId, 0, 1000);
      const segmentsArray = Array.isArray(data) ? data : [];
      const normalized = segmentsArray.map((seg) => withQaData(seg as Segment));
      setSegments(normalized);
      if (segmentsArray.length > 0 && !activeSegmentId) {
        setActiveSegmentId(segmentsArray[0].segmentId);
      }
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
            const validationResult = tagValidator.validate(seg.sourceTokens, targetTokens);
            return { 
              ...seg, 
              targetTokens,
              status: data.status,
              qaIssues: validationResult.issues,
              autoFixSuggestions: validationResult.suggestions
            };
          }
          // 2. Is it a propagated segment?
          if (data.propagatedIds?.includes(seg.segmentId)) {
            changed = true;
            const targetTokens = normalizeTokens(data.targetTokens, `segment ${seg.segmentId} target (propagation)`);
            const validationResult = tagValidator.validate(seg.sourceTokens, targetTokens);
            return { 
              ...seg, 
              targetTokens,
              status: 'draft' as any,
              qaIssues: validationResult.issues,
              autoFixSuggestions: validationResult.suggestions
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

          // Validate tags and store results in segment
          const validationResult = tagValidator.validate(seg.sourceTokens, tokens);
          
          const updated = { 
            ...seg, 
            targetTokens: tokens,
            status: (normalizedText.trim() ? 'draft' : 'new') as any,
            qaIssues: validationResult.issues,
            autoFixSuggestions: validationResult.suggestions
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
        // Validate tags and store results in segment
        const validationResult = tagValidator.validate(seg.sourceTokens, tokens);
        
        const updated = { 
          ...seg, 
          targetTokens: tokens,
          status: 'draft' as any,
          qaIssues: validationResult.issues,
          autoFixSuggestions: validationResult.suggestions
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
