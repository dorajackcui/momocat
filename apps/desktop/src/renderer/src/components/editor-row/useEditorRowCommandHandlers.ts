import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Token, formatTagAsMemoQMarker } from '@cat/core';
import { normalizeRefinementInstruction } from './editorRowUtils';

interface UseEditorRowCommandHandlersParams {
  segmentId: string;
  isActive: boolean;
  isAIRefining: boolean;
  sourceTags: Token[];
  sourceEditorText: string;
  onActivate: (id: string, options?: { autoFocusTarget?: boolean }) => void;
  onAIRefine: (id: string, instruction: string) => void;
  onConfirm: (id: string) => void;
  emitTranslationChange: (nextText: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

type EditorRowShortcutAction =
  | { type: 'confirm' }
  | { type: 'insertAllTags' }
  | { type: 'insertTag'; tagIndex: number }
  | null;

interface EditorRowShortcutKeyInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

interface EditorRowCommandHandlersResult {
  aiRefineInputRef: React.RefObject<HTMLInputElement | null>;
  showTagInsertionUI: boolean;
  showAIRefineInput: boolean;
  aiRefineDraft: string;
  setAiRefineDraft: React.Dispatch<React.SetStateAction<string>>;
  toggleTagInsertionUI: () => void;
  toggleAIRefineInput: () => void;
  handleInsertTag: (tagIndex: number) => void;
  handleInsertAllTags: () => void;
  handleCopySourceToTarget: (event: React.MouseEvent<HTMLButtonElement>) => void;
  handleSourceCellClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleAIRefineInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  handleTargetKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function resolveEditorRowShortcutAction({
  key,
  ctrlKey,
  metaKey,
  shiftKey,
}: EditorRowShortcutKeyInput): EditorRowShortcutAction {
  if ((ctrlKey || metaKey) && key === 'Enter') {
    return { type: 'confirm' };
  }

  if (!(ctrlKey || metaKey) || !shiftKey) {
    return null;
  }

  if (key === '0' || key === ')') {
    return { type: 'insertAllTags' };
  }

  if (/^[1-9]$/.test(key)) {
    return { type: 'insertTag', tagIndex: Number.parseInt(key, 10) - 1 };
  }

  return null;
}

export function useEditorRowCommandHandlers({
  segmentId,
  isActive,
  isAIRefining,
  sourceTags,
  sourceEditorText,
  onActivate,
  onAIRefine,
  onConfirm,
  emitTranslationChange,
  textareaRef,
}: UseEditorRowCommandHandlersParams): EditorRowCommandHandlersResult {
  const aiRefineInputRef = useRef<HTMLInputElement>(null);
  const [showTagInsertionUI, setShowTagInsertionUI] = useState(false);
  const [showAIRefineInput, setShowAIRefineInput] = useState(false);
  const [aiRefineDraft, setAiRefineDraft] = useState('');

  const insertAtSelection = useCallback(
    (insertText: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart ?? 0;
      const end = textarea.selectionEnd ?? start;
      const current = textarea.value;
      const nextText = current.slice(0, start) + insertText + current.slice(end);
      const nextCursor = start + insertText.length;

      emitTranslationChange(nextText);

      requestAnimationFrame(() => {
        if (!textareaRef.current) return;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [emitTranslationChange, textareaRef],
  );

  const handleInsertTag = useCallback(
    (tagIndex: number) => {
      if (tagIndex < 0 || tagIndex >= sourceTags.length) return;
      const marker = formatTagAsMemoQMarker(sourceTags[tagIndex].content, tagIndex + 1);
      insertAtSelection(marker);
      setShowTagInsertionUI(false);
    },
    [insertAtSelection, sourceTags],
  );

  const handleInsertAllTags = useCallback(() => {
    if (sourceTags.length === 0) return;
    const allMarkers = sourceTags
      .map((tag, index) => formatTagAsMemoQMarker(tag.content, index + 1))
      .join('');
    insertAtSelection(allMarkers);
    setShowTagInsertionUI(false);
  }, [insertAtSelection, sourceTags]);

  const handleCopySourceToTarget = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onActivate(segmentId);
      emitTranslationChange(sourceEditorText);
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    },
    [emitTranslationChange, onActivate, segmentId, sourceEditorText, textareaRef],
  );

  const handleSourceCellClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
      onActivate(segmentId, { autoFocusTarget: false });
    },
    [onActivate, segmentId],
  );

  const submitAIRefinement = useCallback(() => {
    if (isAIRefining) return;
    const instruction = normalizeRefinementInstruction(aiRefineDraft);
    if (!instruction) return;
    onAIRefine(segmentId, instruction);
    setShowAIRefineInput(false);
    setAiRefineDraft('');
  }, [aiRefineDraft, isAIRefining, onAIRefine, segmentId]);

  const toggleAIRefineInput = useCallback(() => {
    setShowAIRefineInput((prev) => {
      const next = !prev;
      if (!next) {
        setAiRefineDraft('');
      }
      return next;
    });
  }, []);

  const toggleTagInsertionUI = useCallback(() => {
    setShowTagInsertionUI((prev) => !prev);
  }, []);

  const handleAIRefineInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        submitAIRefinement();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setShowAIRefineInput(false);
        setAiRefineDraft('');
      }
    },
    [submitAIRefinement],
  );

  const handleTargetKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const action = resolveEditorRowShortcutAction(event);
      if (!action) return;

      event.preventDefault();

      if (action.type === 'confirm') {
        void onConfirm(segmentId);
        return;
      }

      if (action.type === 'insertAllTags') {
        handleInsertAllTags();
        return;
      }

      handleInsertTag(action.tagIndex);
    },
    [handleInsertAllTags, handleInsertTag, onConfirm, segmentId],
  );

  useEffect(() => {
    if (!isActive) {
      // Reset transient insertion UI when row loses focus.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowTagInsertionUI(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowAIRefineInput(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAiRefineDraft('');
    }
  }, [isActive]);

  useEffect(() => {
    if (!showAIRefineInput || !isActive) return;
    aiRefineInputRef.current?.focus();
    aiRefineInputRef.current?.select();
  }, [isActive, showAIRefineInput]);

  return {
    aiRefineInputRef,
    showTagInsertionUI,
    showAIRefineInput,
    aiRefineDraft,
    setAiRefineDraft,
    toggleTagInsertionUI,
    toggleAIRefineInput,
    handleInsertTag,
    handleInsertAllTags,
    handleCopySourceToTarget,
    handleSourceCellClick,
    handleAIRefineInputKeyDown,
    handleTargetKeyDown,
  };
}

export type {
  EditorRowCommandHandlersResult,
  EditorRowShortcutAction,
  EditorRowShortcutKeyInput,
  UseEditorRowCommandHandlersParams,
};
