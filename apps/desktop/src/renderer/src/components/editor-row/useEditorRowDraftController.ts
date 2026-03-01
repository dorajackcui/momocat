import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { shouldSyncDraftFromExternalTarget } from './editorRowUtils';

interface UseEditorRowDraftControllerParams {
  segmentId: string;
  targetEditorText: string;
  isActive: boolean;
  disableAutoFocus: boolean;
  showNonPrintingSymbols: boolean;
  targetHighlightQuery: string;
  onAutoFocus?: (id: string) => void;
  onChange: (id: string, value: string) => void;
  onBlur?: (id: string) => Promise<void>;
  onEditStateChange?: (id: string, editing: boolean) => void;
}

interface EditorRowDraftControllerResult {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  mirrorRef: React.RefObject<HTMLDivElement | null>;
  draftText: string;
  isTargetFocused: boolean;
  emitTranslationChange: (nextText: string) => void;
  handleTargetFocus: () => void;
  handleTargetBlur: () => void;
  handleTargetChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

export function useEditorRowDraftController({
  segmentId,
  targetEditorText,
  isActive,
  disableAutoFocus,
  showNonPrintingSymbols,
  targetHighlightQuery,
  onAutoFocus,
  onChange,
  onBlur,
  onEditStateChange,
}: UseEditorRowDraftControllerParams): EditorRowDraftControllerResult {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const wasActiveRef = useRef(false);
  const isMountedRef = useRef(true);
  const [draftText, setDraftText] = useState(targetEditorText);
  const [isDraftSyncSuspended, setIsDraftSyncSuspended] = useState(false);
  const [isTargetFocused, setIsTargetFocused] = useState(false);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!textarea || !mirror) return;
    const nextHeight = Math.max(36, Math.ceil(mirror.getBoundingClientRect().height));
    textarea.style.height = `${nextHeight}px`;
  }, []);

  useEffect(() => {
    if (
      !shouldSyncDraftFromExternalTarget({
        isDraftSyncSuspended,
        draftText,
        targetEditorText,
        isActive,
      })
    ) {
      return;
    }

    const textarea = textareaRef.current;
    const isTextareaFocused =
      typeof document !== 'undefined' && document.activeElement === textarea;
    const selectionStart = isTextareaFocused ? (textarea?.selectionStart ?? 0) : null;
    const selectionEnd = isTextareaFocused ? (textarea?.selectionEnd ?? selectionStart) : null;

    // Sync local draft from external updates and preserve selection when focused.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftText(targetEditorText);
    if (selectionStart === null || selectionEnd === null) return;

    const maxPosition = targetEditorText.length;
    const clampedStart = Math.min(selectionStart, maxPosition);
    const clampedEnd = Math.min(selectionEnd, maxPosition);
    requestAnimationFrame(() => {
      const nextTextarea = textareaRef.current;
      if (!nextTextarea || document.activeElement !== nextTextarea) return;
      nextTextarea.setSelectionRange(clampedStart, clampedEnd);
    });
  }, [draftText, isActive, isDraftSyncSuspended, targetEditorText]);

  useEffect(() => {
    const becameActive = isActive && !wasActiveRef.current;
    if (becameActive && !disableAutoFocus && textareaRef.current) {
      textareaRef.current.focus();
      onAutoFocus?.(segmentId);
    }
    wasActiveRef.current = isActive;
  }, [disableAutoFocus, isActive, onAutoFocus, segmentId]);

  useEffect(
    () => () => {
      onEditStateChange?.(segmentId, false);
    },
    [onEditStateChange, segmentId],
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    resizeTextarea();
  }, [draftText, resizeTextarea, showNonPrintingSymbols, targetHighlightQuery]);

  useEffect(() => {
    const container = textareaRef.current?.parentElement;
    if (!container) return undefined;
    const observer = new ResizeObserver(() => {
      resizeTextarea();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [resizeTextarea]);

  const emitTranslationChange = useCallback(
    (nextText: string) => {
      setDraftText(nextText);
      onChange(segmentId, nextText);
      requestAnimationFrame(() => resizeTextarea());
    },
    [onChange, resizeTextarea, segmentId],
  );

  const handleTargetFocus = useCallback(() => {
    setIsTargetFocused(true);
    setIsDraftSyncSuspended(false);
    onEditStateChange?.(segmentId, true);
  }, [onEditStateChange, segmentId]);

  const handleTargetBlur = useCallback(() => {
    setIsTargetFocused(false);
    if (!onBlur) {
      onEditStateChange?.(segmentId, false);
      return;
    }

    setIsDraftSyncSuspended(true);
    void onBlur(segmentId)
      .catch(() => {
        // Error state is handled by persistence layer.
      })
      .finally(() => {
        if (!isMountedRef.current) return;
        setIsDraftSyncSuspended(false);
        onEditStateChange?.(segmentId, false);
      });
  }, [onBlur, onEditStateChange, segmentId]);

  const handleTargetChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      emitTranslationChange(event.target.value);
    },
    [emitTranslationChange],
  );

  return {
    textareaRef,
    mirrorRef,
    draftText,
    isTargetFocused,
    emitTranslationChange,
    handleTargetFocus,
    handleTargetBlur,
    handleTargetChange,
  };
}

export type { EditorRowDraftControllerResult, UseEditorRowDraftControllerParams };
