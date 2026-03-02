import React from 'react';

interface EditorRowTargetCellProps {
  editorHostRef: React.Ref<HTMLDivElement>;
  isActive: boolean;
}

export const EditorRowTargetCell: React.FC<EditorRowTargetCellProps> = ({
  editorHostRef,
  isActive,
}) => (
  <div className="relative">
    <div
      ref={editorHostRef}
      className={`editor-target-text-layer editor-target-editor-host ${
        !isActive ? 'pointer-events-none' : ''
      }`}
    />
  </div>
);
