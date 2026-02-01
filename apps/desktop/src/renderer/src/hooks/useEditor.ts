import { useState, useEffect, useCallback } from 'react';
import { Segment, Token, parseDisplayTextToTokens, TMEntry } from '@cat/core';

interface UseEditorProps {
  activeFileId: number | null;
}

export function useEditor({ activeFileId }: UseEditorProps) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [activeMatches, setActiveMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
      setSegments(segmentsArray);
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
            return { ...seg, targetTokens: data.targetTokens, status: data.status };
          }
          // 2. Is it a propagated segment?
          if (data.propagatedIds?.includes(seg.segmentId)) {
            changed = true;
            return { 
              ...seg, 
              targetTokens: [...data.targetTokens], 
              status: 'draft' as any
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
    const tokens = parseDisplayTextToTokens(text);
    
    setSegments(prev => prev.map(seg => {
      if (seg.segmentId === segmentId) {
        const updated = { 
          ...seg, 
          targetTokens: tokens,
          status: (text.trim() ? 'draft' : 'new') as any
        };
        // Async save
        window.api.updateSegment(segmentId, tokens, updated.status);
        return updated;
      }
      return seg;
    }));
  };

  const handleApplyMatch = (tokens: Token[]) => {
    if (!activeSegmentId) return;
    
    setSegments(prev => prev.map(seg => {
      if (seg.segmentId === activeSegmentId) {
        const updated = { 
          ...seg, 
          targetTokens: tokens,
          status: 'draft' as any
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
