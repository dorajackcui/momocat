import React from 'react';
import type { SearchableEditorSegment } from '../editorFilterUtils';
import { EditorRow } from '../EditorRow';
import type { EditorMatchMode } from '../editorFilterUtils';

interface EditorListPaneProps {
  filteredSegments: SearchableEditorSegment[];
  activeSegmentId: string | null;
  manualActivationSegmentId: string | null;
  suppressAutoFocusSegmentId: string | null;
  isSearchInputFocused: boolean;
  onRowActivate: (segmentId: string, options?: { autoFocusTarget?: boolean }) => void;
  onRowAutoFocus: (segmentId: string) => void;
  onTranslationChange: (segmentId: string, value: string) => void;
  onAITranslate: (segmentId: string) => void;
  onAIRefine: (segmentId: string, instruction: string) => void;
  onConfirm: (segmentId: string) => void;
  aiTranslatingSegmentIds: Record<string, boolean>;
  segmentSaveErrors: Record<string, string>;
  sourceHighlightQuery: string;
  targetHighlightQuery: string;
  highlightMode: EditorMatchMode;
  showNonPrintingSymbols: boolean;
}

export const EditorListPane: React.FC<EditorListPaneProps> = ({
  filteredSegments,
  activeSegmentId,
  manualActivationSegmentId,
  suppressAutoFocusSegmentId,
  isSearchInputFocused,
  onRowActivate,
  onRowAutoFocus,
  onTranslationChange,
  onAITranslate,
  onAIRefine,
  onConfirm,
  aiTranslatingSegmentIds,
  segmentSaveErrors,
  sourceHighlightQuery,
  targetHighlightQuery,
  highlightMode,
  showNonPrintingSymbols,
}) => {
  return (
    <>
      {filteredSegments.map((item) => (
        <EditorRow
          key={item.segment.segmentId}
          segment={item.segment}
          rowNumber={item.segment.meta?.rowRef || item.originalIndex + 1}
          isActive={item.segment.segmentId === activeSegmentId}
          disableAutoFocus={
            (isSearchInputFocused && manualActivationSegmentId !== item.segment.segmentId) ||
            suppressAutoFocusSegmentId === item.segment.segmentId
          }
          onActivate={onRowActivate}
          onAutoFocus={onRowAutoFocus}
          onChange={onTranslationChange}
          onAITranslate={onAITranslate}
          onAIRefine={onAIRefine}
          onConfirm={onConfirm}
          isAITranslating={Boolean(aiTranslatingSegmentIds[item.segment.segmentId])}
          isAIRefining={Boolean(aiTranslatingSegmentIds[item.segment.segmentId])}
          saveError={segmentSaveErrors[item.segment.segmentId]}
          sourceHighlightQuery={sourceHighlightQuery}
          targetHighlightQuery={targetHighlightQuery}
          highlightMode={highlightMode}
          showNonPrintingSymbols={showNonPrintingSymbols}
        />
      ))}

      {filteredSegments.length === 0 && (
        <div className="px-8 py-10 text-center text-sm text-text-faint">
          No segments match current filters.
        </div>
      )}

      <div className="h-4" />
    </>
  );
};
