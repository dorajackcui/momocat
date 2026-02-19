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
  onActivate: (id: string, options?: { autoFocusTarget?: boolean }) => void;
  onAutoFocus?: (id: string) => void;
  onChange: (id: string, value: string) => void;
  onAITranslate: (id: string) => void;
  onConfirm: (id: string) => void;
  isAITranslating?: boolean;
}

export const EditorRow: React.FC<EditorRowProps> = ({
  segment,
  rowNumber,
  isActive,
  disableAutoFocus = false,
  saveError,
  sourceHighlightQuery = '',
  targetHighlightQuery = '',
  highlightMode = 'contains',
  onActivate,
  onAutoFocus,
  onChange,
  onAITranslate,
  onConfirm,
  isAITranslating = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [contextCopied, setContextCopied] = useState(false);
  const [showTagInsertionUI, setShowTagInsertionUI] = useState(false);
  const [draftText, setDraftText] = useState('');
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

  const resizeTextarea = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    // Reset first, then measure to keep autosize stable when content shrinks/expands.
    el.style.height = '0px';
    el.style.height = `${Math.max(36, el.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    // Sync local draft when active segment changes or external updates arrive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftText(targetEditorText);
  }, [targetEditorText, segment.segmentId]);

  useEffect(() => {
    if (isActive && !disableAutoFocus && textareaRef.current) {
      textareaRef.current.focus();
      onAutoFocus?.(segment.segmentId);
    }
    if (!isActive) {
      // Reset transient insertion UI when row loses focus.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowTagInsertionUI(false);
    }
  }, [disableAutoFocus, isActive, onAutoFocus, segment.segmentId]);

  useEffect(() => {
    return () => {
      if (contextCopiedTimerRef.current !== null) {
        window.clearTimeout(contextCopiedTimerRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    resizeTextarea(textareaRef.current);
  }, [draftText, resizeTextarea]);

  useEffect(() => {
    const syncHeight = () => {
      resizeTextarea(textareaRef.current);
    };
    window.addEventListener('resize', syncHeight);
    return () => window.removeEventListener('resize', syncHeight);
  }, [resizeTextarea]);

  const emitTranslationChange = useCallback(
    (nextText: string) => {
      setDraftText(nextText);
      onChange(segment.segmentId, nextText);
      requestAnimationFrame(() => resizeTextarea(textareaRef.current));
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

  const handleTargetKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onConfirm(segment.segmentId);
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

  const sourceHighlightChunks = useMemo(
    () => buildHighlightChunks(sourceEditorText, sourceHighlightQuery, highlightMode),
    [sourceEditorText, sourceHighlightQuery, highlightMode],
  );
  const targetHighlightChunks = useMemo(
    () => buildHighlightChunks(draftText, targetHighlightQuery, highlightMode),
    [draftText, targetHighlightQuery, highlightMode],
  );
  const showTargetHighlightOverlay = targetHighlightQuery.trim().length > 0;
  const canInsertTags = sourceTags.length > 0;
  const canAITranslate = sourceEditorText.trim().length > 0;
  const showTargetActionButtons = isActive && (canInsertTags || canAITranslate);
  const targetTextLayerClass = showTargetActionButtons
    ? 'editor-target-text-layer pr-12'
    : 'editor-target-text-layer';

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
        } ${isActive ? 'ring-1 ring-inset ring-brand/50' : ''}`}
      >
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={draftText}
            readOnly={!isActive}
            onFocus={() => onActivate(segment.segmentId)}
            onChange={(e) => emitTranslationChange(e.target.value)}
            onInput={(e) => resizeTextarea(e.currentTarget)}
            onKeyDown={handleTargetKeyDown}
            onDoubleClick={(e) => e.currentTarget.select()}
            spellCheck={false}
            className={`${targetTextLayerClass} relative z-10 bg-transparent outline-none resize-none overflow-hidden ${
              !isActive ? 'pointer-events-none' : ''
            } ${!isActive ? 'caret-transparent' : ''}`}
          />

          {showTargetHighlightOverlay && (
            <div
              aria-hidden="true"
              className={`${targetTextLayerClass} pointer-events-none absolute inset-0 overflow-hidden text-transparent select-none`}
            >
              {renderChunks(targetHighlightChunks)}
            </div>
          )}
        </div>

        {showTargetActionButtons && (
          <div className="absolute top-1.5 right-1.5 z-20 flex flex-col items-end gap-1">
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
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
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
        )}

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
          <div className="mt-1 px-1 flex flex-col group">
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
            </div>
            {contextCopied && (
              <div className="mt-1 text-[10px] text-success font-medium">Copied</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
