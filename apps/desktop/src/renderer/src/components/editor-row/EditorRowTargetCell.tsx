import React from 'react';

interface EditorRowTargetCellProps {
  textareaRef: React.Ref<HTMLTextAreaElement>;
  mirrorRef: React.Ref<HTMLDivElement>;
  draftText: string;
  mirrorText: string;
  showNonPrintingTargetOverlay: boolean;
  showTargetOverlay: boolean;
  targetOverlayContent: React.ReactNode;
  isActive: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

const TARGET_TEXT_LAYER_CLASS = 'editor-target-text-layer';

export const EditorRowTargetCell: React.FC<EditorRowTargetCellProps> = ({
  textareaRef,
  mirrorRef,
  draftText,
  mirrorText,
  showNonPrintingTargetOverlay,
  showTargetOverlay,
  targetOverlayContent,
  isActive,
  onFocus,
  onBlur,
  onChange,
  onKeyDown,
}) => (
  <div className="relative">
    <div
      ref={mirrorRef}
      aria-hidden="true"
      className={`${TARGET_TEXT_LAYER_CLASS} pointer-events-none absolute left-0 top-0 w-full invisible whitespace-pre-wrap break-words`}
    >
      {mirrorText || ' '}
    </div>

    <textarea
      ref={textareaRef}
      value={draftText}
      readOnly={!isActive}
      onFocus={onFocus}
      onBlur={onBlur}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onDoubleClick={(event) => event.currentTarget.select()}
      spellCheck={false}
      style={
        showNonPrintingTargetOverlay ? { caretColor: 'rgb(var(--color-editor-text))' } : undefined
      }
      className={`${TARGET_TEXT_LAYER_CLASS} relative z-10 bg-transparent outline-none resize-none overflow-hidden ${
        !isActive ? 'pointer-events-none' : ''
      } ${!isActive ? 'caret-transparent' : ''} ${showNonPrintingTargetOverlay ? 'text-transparent' : ''}`}
    />

    {showTargetOverlay && (
      <div
        aria-hidden="true"
        className={`${TARGET_TEXT_LAYER_CLASS} pointer-events-none absolute inset-0 overflow-hidden select-none ${
          showNonPrintingTargetOverlay ? '' : 'text-transparent'
        }`}
      >
        {targetOverlayContent}
      </div>
    )}
  </div>
);
