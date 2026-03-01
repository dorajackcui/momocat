import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Segment, Token, formatTagAsMemoQMarker, serializeTokensToEditorText } from '@cat/core';
import { TagInsertionUI } from './TagInsertionUI';
import { buildHighlightChunks, EditorMatchMode } from './editorFilterUtils';

interface EditorRowProps {
  segment: Segment;
  rowNumber: number;
  isActive: boolean;
  disableAutoFocus?: boolean;
  saveError?: string;
  sourceHighlightQuery?: string;
  targetHighlightQuery?: string;
  highlightMode?: EditorMatchMode;
  showNonPrintingSymbols?: boolean;
  onActivate: (id: string, options?: { autoFocusTarget?: boolean }) => void;
  onAutoFocus?: (id: string) => void;
  onChange: (id: string, value: string) => void;
  onBlur?: (id: string) => Promise<void>;
  onEditStateChange?: (id: string, editing: boolean) => void;
  onAITranslate: (id: string) => void;
  onAIRefine: (id: string, instruction: string) => void;
  onConfirm: (id: string) => void;
  isAITranslating?: boolean;
  isAIRefining?: boolean;
}

export function hasRefinableTargetText(text: string): boolean {
  return text.trim().length > 0;
}

export function shouldShowAIRefineControl(isActive: boolean, targetText: string): boolean {
  return isActive && hasRefinableTargetText(targetText);
}

export function normalizeRefinementInstruction(instruction: string): string {
  return instruction.trim();
}

interface DraftSyncDecisionInput {
  isDraftSyncSuspended: boolean;
  draftText: string;
  targetEditorText: string;
  isActive: boolean;
}

export function shouldSyncDraftFromExternalTarget({
  isDraftSyncSuspended,
  draftText,
  targetEditorText,
  isActive,
}: DraftSyncDecisionInput): boolean {
  // Keep blur-flush protection only after row becomes inactive.
  // This lets TM/TB side-panel apply updates reflect immediately on the active row.
  if (isDraftSyncSuspended && !isActive) return false;
  if (draftText === targetEditorText) return false;
  return true;
}

interface NonPrintingVisualizationOptions {
  showLineBreakSymbol?: boolean;
}

export function visualizeNonPrintingSymbols(
  text: string,
  options: NonPrintingVisualizationOptions = {},
): string {
  const { showLineBreakSymbol = true } = options;
  let visualized = text
    .replace(/\u202F/g, '⎵')
    .replace(/\u00A0/g, '⍽')
    .replace(/ /g, '·')
    .replace(/\t/g, '⇥');
  if (showLineBreakSymbol) {
    visualized = visualized.replace(/\n/g, '↵\n');
  }
  return visualized;
}

export function parseVisualizedNonPrintingSymbols(text: string): string {
  let result = '';
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '·') {
      result += ' ';
      continue;
    }
    if (char === '⍽') {
      result += '\u00A0';
      continue;
    }
    if (char === '⎵') {
      result += '\u202F';
      continue;
    }
    if (char === '⇥') {
      result += '\t';
      continue;
    }
    if (char === '↵' && next === '\n') {
      continue;
    }
    result += char;
  }
  return result;
}

const EditorRowComponent: React.FC<EditorRowProps> = ({
  segment,
  rowNumber,
  isActive,
  disableAutoFocus = false,
  saveError,
  sourceHighlightQuery = '',
  targetHighlightQuery = '',
  highlightMode = 'contains',
  showNonPrintingSymbols = false,
  onActivate,
  onAutoFocus,
  onChange,
  onBlur,
  onEditStateChange,
  onAITranslate,
  onAIRefine,
  onConfirm,
  isAITranslating = false,
  isAIRefining = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const aiRefineInputRef = useRef<HTMLInputElement>(null);
  const wasActiveRef = useRef(false);
  const isMountedRef = useRef(true);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [contextCopied, setContextCopied] = useState(false);
  const [showTagInsertionUI, setShowTagInsertionUI] = useState(false);
  const [showAIRefineInput, setShowAIRefineInput] = useState(false);
  const [aiRefineDraft, setAiRefineDraft] = useState('');
  const [isTargetFocused, setIsTargetFocused] = useState(false);
  const [draftText, setDraftText] = useState(() =>
    serializeTokensToEditorText(segment.targetTokens, segment.sourceTokens)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n'),
  );
  const [isDraftSyncSuspended, setIsDraftSyncSuspended] = useState(false);
  const [isSourceHovered, setIsSourceHovered] = useState(false);
  const contextCopiedTimerRef = useRef<number | null>(null);

  const qaIssues = segment.qaIssues || [];
  const hasError = qaIssues.some((issue) => issue.severity === 'error');
  const hasWarning = qaIssues.some((issue) => issue.severity === 'warning');

  const sourceTags = useMemo(() => {
    const seen = new Set<string>();
    return segment.sourceTokens.filter((token): token is Token => {
      if (token.type !== 'tag') return false;
      if (seen.has(token.content)) return false;
      seen.add(token.content);
      return true;
    });
  }, [segment.sourceTokens]);

  const sourceEditorText = useMemo(
    () =>
      serializeTokensToEditorText(segment.sourceTokens, segment.sourceTokens)
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n'),
    [segment.sourceTokens],
  );

  const targetEditorText = useMemo(
    () =>
      serializeTokensToEditorText(segment.targetTokens, segment.sourceTokens)
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n'),
    [segment.targetTokens, segment.sourceTokens],
  );

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

    // Sync local draft from external updates, and preserve caret/selection when focused.
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
      onAutoFocus?.(segment.segmentId);
    }
    if (!isActive) {
      // Reset transient insertion UI when row loses focus.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowTagInsertionUI(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowAIRefineInput(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAiRefineDraft('');
    }
    wasActiveRef.current = isActive;
  }, [disableAutoFocus, isActive, onAutoFocus, onEditStateChange, segment.segmentId]);

  useEffect(
    () => () => {
      onEditStateChange?.(segment.segmentId, false);
    },
    [onEditStateChange, segment.segmentId],
  );

  useEffect(() => {
    if (!showAIRefineInput || !isActive) return;
    aiRefineInputRef.current?.focus();
    aiRefineInputRef.current?.select();
  }, [isActive, showAIRefineInput]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (contextCopiedTimerRef.current !== null) {
        window.clearTimeout(contextCopiedTimerRef.current);
      }
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
      onChange(segment.segmentId, nextText);
      requestAnimationFrame(() => resizeTextarea());
    },
    [onChange, segment.segmentId, resizeTextarea],
  );

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
    [emitTranslationChange],
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

  const handleCopySourceToTarget = (e: React.MouseEvent) => {
    e.stopPropagation();
    onActivate(segment.segmentId);
    emitTranslationChange(sourceEditorText);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const handleSourceCellClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onActivate(segment.segmentId, { autoFocusTarget: false });
  };

  const submitAIRefinement = useCallback(() => {
    if (isAIRefining) return;
    const instruction = normalizeRefinementInstruction(aiRefineDraft);
    if (!instruction) return;
    onAIRefine(segment.segmentId, instruction);
    setShowAIRefineInput(false);
    setAiRefineDraft('');
  }, [aiRefineDraft, isAIRefining, onAIRefine, segment.segmentId]);

  const toggleAIRefineInput = useCallback(() => {
    setShowAIRefineInput((prev) => {
      const next = !prev;
      if (!next) {
        setAiRefineDraft('');
      }
      return next;
    });
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

  const handleTargetKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void onConfirm(segment.segmentId);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      if (e.key === '0' || e.key === ')') {
        e.preventDefault();
        handleInsertAllTags();
        return;
      }

      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        handleInsertTag(Number.parseInt(e.key, 10) - 1);
      }
    }
  };

  const statusLine = hasError
    ? 'bg-danger'
    : hasWarning
      ? 'bg-warning'
      : segment.status === 'confirmed'
        ? 'bg-success'
        : segment.status === 'reviewed'
          ? 'bg-info'
          : segment.status === 'translated'
            ? 'bg-brand'
            : segment.status === 'draft'
              ? 'bg-warning'
              : 'bg-text-faint';

  const statusTitle = hasError
    ? `Status: ${segment.status} (QA error)`
    : hasWarning
      ? `Status: ${segment.status} (QA warning)`
      : `Status: ${segment.status}`;

  const contextText = segment.meta?.context || '';
  const isLongContext = contextText.length > 120;
  const displayContext =
    isContextExpanded || !isLongContext ? contextText : `${contextText.substring(0, 110)}...`;

  const copyContextText = useCallback(async (text: string): Promise<boolean> => {
    if (!text) return false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fallback below
    }

    try {
      const temp = document.createElement('textarea');
      temp.value = text;
      temp.setAttribute('readonly', 'true');
      temp.style.position = 'fixed';
      temp.style.opacity = '0';
      temp.style.pointerEvents = 'none';
      document.body.appendChild(temp);
      temp.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(temp);
      return copied;
    } catch {
      return false;
    }
  }, []);

  const handleCopyContext = useCallback(
    async (event: React.MouseEvent) => {
      event.stopPropagation();
      const normalized = contextText.trim();
      if (!normalized) return;
      const copied = await copyContextText(contextText);
      if (!copied) return;

      setContextCopied(true);
      if (contextCopiedTimerRef.current !== null) {
        window.clearTimeout(contextCopiedTimerRef.current);
      }
      contextCopiedTimerRef.current = window.setTimeout(() => {
        setContextCopied(false);
      }, 1200);
    },
    [contextText, copyContextText],
  );

  const sourceDisplayText = useMemo(
    () =>
      showNonPrintingSymbols ? visualizeNonPrintingSymbols(sourceEditorText) : sourceEditorText,
    [showNonPrintingSymbols, sourceEditorText],
  );
  const showNonPrintingTargetOverlay = showNonPrintingSymbols && !isTargetFocused;
  const targetEditorDisplayText = useMemo(
    () =>
      showNonPrintingTargetOverlay
        ? visualizeNonPrintingSymbols(draftText, { showLineBreakSymbol: false })
        : draftText,
    [draftText, showNonPrintingTargetOverlay],
  );
  const sourceDisplayQuery = useMemo(
    () =>
      showNonPrintingSymbols
        ? visualizeNonPrintingSymbols(sourceHighlightQuery)
        : sourceHighlightQuery,
    [showNonPrintingSymbols, sourceHighlightQuery],
  );
  const targetDisplayQuery = useMemo(
    () =>
      showNonPrintingTargetOverlay
        ? visualizeNonPrintingSymbols(targetHighlightQuery, { showLineBreakSymbol: false })
        : targetHighlightQuery,
    [showNonPrintingTargetOverlay, targetHighlightQuery],
  );
  const sourceHighlightChunks = useMemo(
    () => buildHighlightChunks(sourceDisplayText, sourceDisplayQuery, highlightMode),
    [sourceDisplayText, sourceDisplayQuery, highlightMode],
  );
  const targetHighlightChunks = useMemo(
    () => buildHighlightChunks(targetEditorDisplayText, targetDisplayQuery, highlightMode),
    [targetEditorDisplayText, targetDisplayQuery, highlightMode],
  );
  const showTargetHighlightOverlay = targetHighlightQuery.trim().length > 0;
  const canInsertTags = sourceTags.length > 0;
  const canAITranslate = sourceEditorText.trim().length > 0;
  const hasRefinableTarget = hasRefinableTargetText(draftText);
  const showAIRefineControl = shouldShowAIRefineControl(isActive, draftText);
  const showTargetActionButtons =
    isActive && (canInsertTags || canAITranslate || hasRefinableTarget);
  const targetTextLayerClass = 'editor-target-text-layer';
  const showTargetOverlay = showNonPrintingTargetOverlay || showTargetHighlightOverlay;

  const renderChunks = useCallback(
    (chunks: ReturnType<typeof buildHighlightChunks>) =>
      chunks.map((chunk, index) =>
        chunk.isMatch ? (
          <mark key={index} className="bg-warning-soft text-inherit rounded-[2px]">
            {chunk.text}
          </mark>
        ) : (
          <span key={index}>{chunk.text}</span>
        ),
      ),
    [],
  );

  return (
    <div
      className={`group grid grid-cols-[30px_1fr_4px_1fr] border-b border-border transition-colors ${
        isActive ? 'bg-brand-soft/20' : 'hover:bg-muted/30'
      }`}
      onClick={() => onActivate(segment.segmentId)}
    >
      <div className="px-0 py-0.5 border-r border-border bg-muted/50 flex items-start justify-center">
        <div className="mt-0.5 text-[9px] font-medium text-text-faint select-none">{rowNumber}</div>
      </div>

      <div
        className="px-1.5 py-0.5 editor-cell-bg relative"
        onMouseEnter={() => setIsSourceHovered(true)}
        onMouseLeave={() => setIsSourceHovered(false)}
        onClick={handleSourceCellClick}
      >
        <div className="editor-source-text">{renderChunks(sourceHighlightChunks)}</div>
        {isSourceHovered && (
          <div className="absolute top-2 right-2">
            <button
              onClick={handleCopySourceToTarget}
              className="p-1 rounded bg-surface/75 border border-border/80 hover:bg-brand-soft/80 hover:border-brand/40 text-text-muted hover:text-brand transition-all shadow-sm"
              title="Copy Source to Target"
              aria-label="Copy source to target"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 5l7 7-7 7M5 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="relative overflow-visible" title={statusTitle}>
        <div className={`absolute inset-0 w-full ${statusLine}`} />
      </div>

      <div
        className={`px-1.5 py-0.5 relative ${
          hasError ? 'bg-danger-soft/40' : hasWarning ? 'bg-warning-soft/35' : 'editor-cell-bg'
        }`}
      >
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -top-px -bottom-px left-0 right-0 z-20 border-t-[3px] border-r-[3px] border-b-[3px] border-brand/70 transition-opacity duration-150 ${
            isActive ? 'opacity-100 shadow-sm' : 'opacity-0'
          }`}
        />

        <div className="relative">
          <div
            ref={mirrorRef}
            aria-hidden="true"
            className={`${targetTextLayerClass} pointer-events-none absolute left-0 top-0 w-full invisible whitespace-pre-wrap break-words`}
          >
            {(showNonPrintingTargetOverlay
              ? visualizeNonPrintingSymbols(draftText, { showLineBreakSymbol: false })
              : draftText) || ' '}
          </div>

          <textarea
            ref={textareaRef}
            value={draftText}
            readOnly={!isActive}
            onFocus={() => {
              onActivate(segment.segmentId);
              setIsTargetFocused(true);
              setIsDraftSyncSuspended(false);
              onEditStateChange?.(segment.segmentId, true);
            }}
            onBlur={() => {
              setIsTargetFocused(false);
              if (!onBlur) {
                onEditStateChange?.(segment.segmentId, false);
                return;
              }
              setIsDraftSyncSuspended(true);
              void onBlur(segment.segmentId)
                .catch(() => {
                  // Error state is handled by persistence layer.
                })
                .finally(() => {
                  if (!isMountedRef.current) return;
                  setIsDraftSyncSuspended(false);
                  onEditStateChange?.(segment.segmentId, false);
                });
            }}
            onChange={(e) => emitTranslationChange(e.target.value)}
            onKeyDown={handleTargetKeyDown}
            onDoubleClick={(e) => e.currentTarget.select()}
            spellCheck={false}
            style={
              showNonPrintingTargetOverlay
                ? { caretColor: 'rgb(var(--color-editor-text))' }
                : undefined
            }
            className={`${targetTextLayerClass} relative z-10 bg-transparent outline-none resize-none overflow-hidden ${
              !isActive ? 'pointer-events-none' : ''
            } ${!isActive ? 'caret-transparent' : ''} ${showNonPrintingTargetOverlay ? 'text-transparent' : ''}`}
          />

          {showTargetOverlay && (
            <div
              aria-hidden="true"
              className={`${targetTextLayerClass} pointer-events-none absolute inset-0 overflow-hidden select-none ${
                showNonPrintingTargetOverlay ? '' : 'text-transparent'
              }`}
            >
              {renderChunks(targetHighlightChunks)}
            </div>
          )}
        </div>

        {showAIRefineInput && showAIRefineControl && (
          <div className="absolute top-1.5 right-9 z-30">
            <input
              ref={aiRefineInputRef}
              value={aiRefineDraft}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setAiRefineDraft(event.target.value)}
              onKeyDown={handleAIRefineInputKeyDown}
              disabled={isAIRefining}
              placeholder="Refine prompt(Enter to send)"
              className="field-input !w-56 !px-2.5 !py-1 text-[11px] leading-tight !bg-surface/50 border-border/70 backdrop-blur-sm shadow-sm disabled:opacity-60 disabled:cursor-wait"
              aria-label="AI refine instruction"
            />
          </div>
        )}

        <div
          className={`absolute top-1.5 right-1.5 z-20 flex min-w-[30px] flex-col items-end gap-1 transition-opacity ${
            showTargetActionButtons ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          {showAIRefineControl && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (isAIRefining) return;
                toggleAIRefineInput();
              }}
              disabled={isAIRefining}
              className="relative z-20 p-1 rounded bg-surface/80 border border-border/70 hover:bg-brand-soft/75 hover:border-brand/40 text-text-muted hover:text-brand transition-all shadow-sm disabled:opacity-60 disabled:cursor-wait"
              title="AI refine this translation"
              aria-label="AI refine this translation"
            >
              {isAIRefining ? (
                <svg
                  className="w-3.5 h-3.5 animate-spin"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v4m0 8v4m8-8h-4M8 12H4m12.364 5.364l-2.828-2.828M9.464 9.464L6.636 6.636m9.728 0l-2.828 2.828m-4.072 4.072l-2.828 2.828"
                  />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 18h18M7 18c0-6 3-10 5-10s5 4 5 10"
                  />
                </svg>
              )}
            </button>
          )}

          {canAITranslate && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAITranslate(segment.segmentId);
              }}
              disabled={isAITranslating}
              className="relative z-20 p-1 rounded bg-surface/70 border border-border/70 hover:bg-brand-soft/75 hover:border-brand/40 text-text-muted hover:text-brand transition-all shadow-sm disabled:opacity-60 disabled:cursor-wait"
              title="AI translate this segment"
              aria-label="AI translate this segment"
            >
              {isAITranslating ? (
                <svg
                  className="w-3.5 h-3.5 animate-spin"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v4m0 8v4m8-8h-4M8 12H4m12.364 5.364l-2.828-2.828M9.464 9.464L6.636 6.636m9.728 0l-2.828 2.828m-4.072 4.072l-2.828 2.828"
                  />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3z"
                  />
                </svg>
              )}
            </button>
          )}

          {canInsertTags && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setShowTagInsertionUI(!showTagInsertionUI);
              }}
              className="relative z-20 p-1 rounded bg-surface/90 border border-border/80 hover:bg-brand-soft/80 hover:border-brand/40 text-text-muted hover:text-brand transition-all shadow-sm"
              title="Insert tags from source (Ctrl+Shift+1-9)"
              aria-label="Toggle tag insertion menu"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
            </button>
          )}
        </div>

        <TagInsertionUI
          sourceTags={sourceTags}
          onInsertTag={handleInsertTag}
          onInsertAllTags={handleInsertAllTags}
          isVisible={isActive && showTagInsertionUI}
        />

        {qaIssues.length > 0 && (
          <div className="mt-1 space-y-1">
            {qaIssues.map((issue, idx) => (
              <div
                key={idx}
                className={`text-[10px] flex items-center gap-1.5 px-2 py-0.5 rounded ${
                  issue.severity === 'error'
                    ? 'bg-danger-soft text-danger'
                    : 'bg-warning-soft text-warning'
                }`}
              >
                <span className="font-bold uppercase text-[8px]">{issue.severity}:</span>
                {issue.message}
              </div>
            ))}
          </div>
        )}

        {saveError && (
          <div className="mt-1 text-[10px] flex items-center gap-1.5 px-2 py-0.5 rounded bg-danger-soft text-danger">
            <span className="font-bold uppercase text-[8px]">save:</span>
            {saveError}
          </div>
        )}

        {segment.meta?.context && (
          <div className="mt-1 px-1 group">
            <div
              onClick={(event) => void handleCopyContext(event)}
              title="Click to copy context"
              className="text-[11px] text-text-faint italic leading-snug cursor-copy hover:text-text-muted transition-colors"
            >
              {displayContext}
              {isLongContext && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsContextExpanded(!isContextExpanded);
                  }}
                  className="ml-1 text-brand hover:text-brand font-medium not-italic"
                >
                  {isContextExpanded ? 'Collapse' : 'more'}
                </button>
              )}
              <span className="ml-1 inline-flex h-3 w-3 items-center justify-center text-success">
                <svg
                  className={`w-3 h-3 transition-opacity duration-150 ${contextCopied ? 'opacity-100' : 'opacity-0'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-label={contextCopied ? 'Context copied' : undefined}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const areEditorRowPropsEqual = (prev: EditorRowProps, next: EditorRowProps): boolean =>
  prev.segment === next.segment &&
  prev.rowNumber === next.rowNumber &&
  prev.isActive === next.isActive &&
  prev.disableAutoFocus === next.disableAutoFocus &&
  prev.saveError === next.saveError &&
  prev.sourceHighlightQuery === next.sourceHighlightQuery &&
  prev.targetHighlightQuery === next.targetHighlightQuery &&
  prev.highlightMode === next.highlightMode &&
  prev.showNonPrintingSymbols === next.showNonPrintingSymbols &&
  prev.isAITranslating === next.isAITranslating &&
  prev.isAIRefining === next.isAIRefining &&
  prev.onActivate === next.onActivate &&
  prev.onAutoFocus === next.onAutoFocus &&
  prev.onChange === next.onChange &&
  prev.onBlur === next.onBlur &&
  prev.onEditStateChange === next.onEditStateChange &&
  prev.onAITranslate === next.onAITranslate &&
  prev.onAIRefine === next.onAIRefine &&
  prev.onConfirm === next.onConfirm;

export const EditorRow = React.memo(EditorRowComponent, areEditorRowPropsEqual);
