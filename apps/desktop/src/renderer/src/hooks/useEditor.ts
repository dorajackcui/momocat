import { useState, useEffect, useCallback } from 'react';
import { Segment, Token, parseDisplayTextToTokens } from '@cat/core';

interface UseEditorProps {
  activeFileId: number | null;
}

export function useEditor({ activeFileId }: UseEditorProps) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load Segments
  const loadSegments = useCallback(async () => {
    if (activeFileId === null) {
      setSegments([]);
      return;
    }

    setLoading(true);
    try {
      const data = await window.api.getSegments(activeFileId, 0, 1000);
      const segmentsArray = Array.isArray(data) ? data : [];
      setSegments(segmentsArray);
      if (segmentsArray.length > 0 && !activeSegmentId) {
        setActiveSegmentId(segmentsArray[0].segmentId);
      }
    } catch (error) {
      console.error('Failed to load segments:', error);
    } finally {
      setLoading(false);
    }
  }, [activeFileId]);

  useEffect(() => {
    loadSegments();
  }, [loadSegments]);

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

  const confirmSegment = async (segmentId: string) => {
    const segment = segments.find(s => s.segmentId === segmentId);
    if (!segment) return;

    await window.api.updateSegment(segmentId, segment.targetTokens, 'confirmed');
    
    setSegments(prev => prev.map(seg => 
      seg.segmentId === segmentId ? { ...seg, status: 'confirmed' } : seg
    ));

    // Jump to next
    const currentIndex = segments.findIndex(s => s.segmentId === segmentId);
    if (currentIndex < segments.length - 1) {
      setActiveSegmentId(segments[currentIndex + 1].segmentId);
    }
  };

  const getActiveSegment = () => segments.find(s => s.segmentId === activeSegmentId);

  return {
    segments,
    activeSegmentId,
    setActiveSegmentId,
    loading,
    handleTranslationChange,
    confirmSegment,
    getActiveSegment,
  };
}
