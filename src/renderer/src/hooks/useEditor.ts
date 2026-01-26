import { useState, useEffect, useCallback } from 'react';
import { Segment } from '../types';

interface UseEditorProps {
  activeFileId: number | null;
  files: any[]; // To look up metadata like original path
  onProgressUpdate?: (id: number, progress: number) => void;
  onUpdateTM: (source: string, target: string) => Promise<void>;
}

export function useEditor({ activeFileId, files, onProgressUpdate, onUpdateTM }: UseEditorProps) {
  // Editor State
  const [filePath, setFilePath] = useState<string | null>(null);
  const [originalFilePath, setOriginalFilePath] = useState<string | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);

  // Column Selection
  const [rawGridData, setRawGridData] = useState<any[][]>([]);
  const [showColSelector, setShowColSelector] = useState(false);
  const [colMapping, setColMapping] = useState({ source: 0, target: 1 });

  // Load File Content
  useEffect(() => {
    const loadContent = async () => {
      if (activeFileId === null) {
        setSegments([]);
        setFilePath(null);
        setOriginalFilePath(null);
        return;
      }

      try {
        const fileContent = await window.api.openProjectFile(activeFileId);
        const fileMeta = files.find((f) => f.id === activeFileId);

        setFilePath(fileMeta?.storedPath || null);
        setOriginalFilePath(fileMeta?.originalPath || null);
        setRawGridData(fileContent.rawGridData || []);

        if (fileContent.segments && fileContent.segments.length > 0) {
          setSegments(fileContent.segments);
          setColMapping(fileContent.colMapping || { source: 0, target: 1 });
          setShowColSelector(false);
        } else {
          // New file or no segments yet
          setColMapping({ source: 0, target: 1 }); // Default
          setShowColSelector(true);
        }
      } catch (error) {
        console.error('Failed to open file:', error);
        alert('Failed to open file');
      }
    };

    loadContent();
  }, [activeFileId, files]);

  // Auto-save
  useEffect(() => {
    if (activeFileId !== null && segments.length > 0) {
      const saveTimer = setTimeout(() => {
        window.api.saveProgress(activeFileId, segments, colMapping).then(() => {
          // Calculate and notify progress
          const total = segments.length;
          const translated = segments.filter((s) => s.target && s.target.trim() !== '').length;
          const progress = total > 0 ? Math.round((translated / total) * 100) : 0;
          
          if (onProgressUpdate) {
            onProgressUpdate(activeFileId, progress);
          }
        });
      }, 1000); // Auto-save every 1s of inactivity
      return () => clearTimeout(saveTimer);
    }
    return;
  }, [segments, activeFileId, colMapping, onProgressUpdate]);

  // Actions
  const handleColumnConfirm = async (sourceIndex: number, targetIndex: number) => {
    setShowColSelector(false);
    setColMapping({ source: sourceIndex, target: targetIndex });

    const dataRows = rawGridData.slice(1);
    const validRows = dataRows; 

    const processedSegments = validRows.map((row, index) => ({
      id: index,
      source: row[sourceIndex] ? String(row[sourceIndex]) : '',
      target: row[targetIndex] ? String(row[targetIndex]) : '',
      isTmMatch: false,
    }));

    setSegments(processedSegments);

    const firstNonEmpty = processedSegments.findIndex((s) => s.source);
    if (firstNonEmpty !== -1) setActiveSegmentId(firstNonEmpty);
  };

  const handleTranslationChange = (id: number, value: string) => {
    setSegments((prev) => prev.map((seg) => (seg.id === id ? { ...seg, target: value } : seg)));
  };

  const handleActivate = (id: number) => {
    setActiveSegmentId(id);
  };

  const handleNext = async () => {
    // 1. Save current segment to TM
    if (activeSegmentId !== null) {
      const currentSegment = segments.find((s) => s.id === activeSegmentId);
      if (currentSegment && currentSegment.source && currentSegment.target) {
        await onUpdateTM(currentSegment.source, currentSegment.target);
      }
    }

    // 2. Move to next
    if (activeSegmentId !== null && activeSegmentId < segments.length - 1) {
      setActiveSegmentId(activeSegmentId + 1);
    }
  };

  const handlePrev = () => {
    if (activeSegmentId !== null && activeSegmentId > 0) {
      setActiveSegmentId(activeSegmentId - 1);
    }
  };

  const handleExport = async () => {
    if (filePath) {
      const data = segments.map((s) => [s.source, s.target]);
      const defaultPath = (originalFilePath || filePath).replace(
        /(\.xlsx|\.xls)$/i,
        '_translated.xlsx',
      );

      try {
        if (!window.api) throw new Error('API is not available');

        const result = await window.api.saveFile(defaultPath, data, filePath, colMapping.target);

        if (result) {
          alert('File saved to ' + result);
        }
      } catch (error) {
        console.error('Export failed:', error);
        alert('Export failed: ' + (error as Error).message);
      }
    }
  };
  
  const getActiveSegmentSource = () => {
    if (activeSegmentId === null) return undefined;
    return segments.find(s => s.id === activeSegmentId)?.source;
  };

  return {
    // State
    filePath,
    originalFilePath,
    segments,
    activeSegmentId,
    showColSelector,
    rawGridData,
    
    // Actions
    handleColumnConfirm,
    handleTranslationChange,
    handleActivate,
    handleNext,
    handlePrev,
    handleExport,
    setShowColSelector,
    
    // Helpers
    getActiveSegmentSource,
  };
}
