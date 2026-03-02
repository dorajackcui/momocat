import { RefObject, useEffect, useRef } from 'react';
import { createCodeMirrorAdapter } from '../../components/editor-engine/codemirrorAdapter';
import { EditorEngineAdapter, EditorEngineCallbacks, EditorEngineOptions } from '../../components/editor-engine/types';

interface UseEditorEngineBridgeParams {
  initialText: string;
  options: EditorEngineOptions;
  callbacks: EditorEngineCallbacks;
}

interface UseEditorEngineBridgeResult {
  editorHostRef: RefObject<HTMLDivElement | null>;
  adapterRef: RefObject<EditorEngineAdapter | null>;
}

export function useEditorEngineBridge({
  initialText,
  options,
  callbacks,
}: UseEditorEngineBridgeParams): UseEditorEngineBridgeResult {
  const editorHostRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<EditorEngineAdapter | null>(null);
  const initialTextRef = useRef(initialText);
  const callbackRef = useRef(callbacks);
  callbackRef.current = callbacks;

  if (!adapterRef.current) {
    adapterRef.current = createCodeMirrorAdapter({
      callbacks: {
        onTextChange: (nextText) => callbackRef.current.onTextChange(nextText),
        onFocusChange: (focused) => callbackRef.current.onFocusChange(focused),
        onShortcutAction: (action) => callbackRef.current.onShortcutAction(action),
      },
      initialOptions: options,
    });
  }

  useEffect(() => {
    const host = editorHostRef.current;
    if (!host || !adapterRef.current) return;

    adapterRef.current.mount(host, initialTextRef.current);
    return () => {
      adapterRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    adapterRef.current?.setOptions({
      editable: options.editable,
      showNonPrintingSymbols: options.showNonPrintingSymbols,
      highlightQuery: options.highlightQuery,
      highlightMode: options.highlightMode,
    });
  }, [options.editable, options.highlightMode, options.highlightQuery, options.showNonPrintingSymbols]);

  return {
    editorHostRef,
    adapterRef,
  };
}

export type { UseEditorEngineBridgeParams, UseEditorEngineBridgeResult };
