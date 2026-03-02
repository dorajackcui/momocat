import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorMatchMode } from '../editorFilterUtils';
import { EditorShortcutAction } from '../editor-engine/types';
import { useEditorEngineBridge } from '../../hooks/editor/useEditorEngineBridge';
import { shouldSyncDraftFromExternalTarget } from './editorRowUtils';

interface UseEditorRowDraftControllerParams {
  segmentId: string;
  targetEditorText: string;
  targetHighlightQuery: string;
  highlightMode: EditorMatchMode;
  isActive: boolean;
  disableAutoFocus: boolean;
  showNonPrintingSymbols: boolean;
  onAutoFocus?: (id: string) => void;
  onChange: (id: string, value: string) => void;
  onBlur?: (id: string) => Promise<void>;
  onEditStateChange?: (id: string, editing: boolean) => void;
}

interface EditorRowDraftControllerResult {
  editorHostRef: RefObject<HTMLDivElement | null>;
  draftText: string;
  emitTranslationChange: (nextText: string) => void;
  setShortcutActionHandler: (handler: (action: EditorShortcutAction) => void) => void;
  editorController: {
    getSnapshot: () =>
      | {
          text: string;
          selectionFrom: number;
          selectionTo: number;
        }
      | null;
    setText: (nextText: string, preserveSelection?: boolean) => void;
    replaceSelection: (insertText: string) => void;
    focus: () => void;
  };
}

export function useEditorRowDraftController({
  segmentId,
  targetEditorText,
  targetHighlightQuery,
  highlightMode,
  isActive,
  disableAutoFocus,
  showNonPrintingSymbols,
  onAutoFocus,
  onChange,
  onBlur,
  onEditStateChange,
}: UseEditorRowDraftControllerParams): EditorRowDraftControllerResult {
  const wasActiveRef = useRef(false);
  const isMountedRef = useRef(true);
  const [draftText, setDraftText] = useState(targetEditorText);
  const [isDraftSyncSuspended, setIsDraftSyncSuspended] = useState(false);
  const suppressNextEngineChangeRef = useRef(false);
  const shortcutActionHandlerRef = useRef<((action: EditorShortcutAction) => void) | null>(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const emitTranslationChange = useCallback(
    (nextText: string) => {
      setDraftText(nextText);
      onChange(segmentId, nextText);
    },
    [onChange, segmentId],
  );

  const handleEngineFocusChange = useCallback(
    (focused: boolean) => {
      if (focused) {
        setIsDraftSyncSuspended(false);
        onEditStateChange?.(segmentId, true);
        return;
      }

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
    },
    [onBlur, onEditStateChange, segmentId],
  );

  const engineOptions = useMemo(
    () => ({
      editable: isActive,
      showNonPrintingSymbols,
      highlightQuery: targetHighlightQuery,
      highlightMode,
    }),
    [highlightMode, isActive, showNonPrintingSymbols, targetHighlightQuery],
  );

  const { editorHostRef, adapterRef } = useEditorEngineBridge({
    initialText: targetEditorText,
    options: engineOptions,
    callbacks: {
      onTextChange: (nextText) => {
        if (suppressNextEngineChangeRef.current) {
          suppressNextEngineChangeRef.current = false;
          return;
        }
        emitTranslationChange(nextText);
      },
      onFocusChange: handleEngineFocusChange,
      onShortcutAction: (action) => {
        shortcutActionHandlerRef.current?.(action);
      },
    },
  });

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
    setDraftText(targetEditorText);
    suppressNextEngineChangeRef.current = true;
    adapterRef.current?.setText(targetEditorText, true);
  }, [adapterRef, draftText, isActive, isDraftSyncSuspended, targetEditorText]);

  useEffect(() => {
    const becameActive = isActive && !wasActiveRef.current;
    if (becameActive && !disableAutoFocus) {
      adapterRef.current?.focus();
      onAutoFocus?.(segmentId);
    }
    wasActiveRef.current = isActive;
  }, [adapterRef, disableAutoFocus, isActive, onAutoFocus, segmentId]);

  useEffect(
    () => () => {
      onEditStateChange?.(segmentId, false);
    },
    [onEditStateChange, segmentId],
  );

  const setShortcutActionHandler = useCallback((handler: (action: EditorShortcutAction) => void) => {
    shortcutActionHandlerRef.current = handler;
  }, []);

  const editorController = useMemo(
    () => ({
      getSnapshot: () => {
        const adapter = adapterRef.current;
        if (!adapter) return null;
        const snapshot = adapter.getSnapshot();
        return {
          text: snapshot.text,
          selectionFrom: snapshot.selectionFrom,
          selectionTo: snapshot.selectionTo,
        };
      },
      setText: (nextText: string, preserveSelection: boolean = false) => {
        setDraftText(nextText);
        suppressNextEngineChangeRef.current = true;
        adapterRef.current?.setText(nextText, preserveSelection);
        onChange(segmentId, nextText);
      },
      replaceSelection: (insertText: string) => {
        adapterRef.current?.replaceSelection(insertText);
      },
      focus: () => {
        adapterRef.current?.focus();
      },
    }),
    [adapterRef, onChange, segmentId],
  );

  return {
    editorHostRef,
    draftText,
    emitTranslationChange,
    setShortcutActionHandler,
    editorController,
  };
}

export type { EditorRowDraftControllerResult, UseEditorRowDraftControllerParams };
