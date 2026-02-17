import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  onActivate: (id: string) => void;
  onAutoFocus?: (id: string) => void;
  onChange: (id: string, value: string) => void;
  onConfirm: (id: string) => void;
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
  onConfirm,
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
    el.style.height = 'auto';
    el.style.height = `${Math.max(40, el.scrollHeight)}px`;
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

  useEffect(() => {
    resizeTextarea(textareaRef.current);
  }, [draftText, resizeTextarea]);

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
      className={`group grid grid-cols-[30px_1fr_5px_1fr] border-b border-border transition-colors ${
        isActive ? 'bg-brand-soft/20' : 'hover:bg-muted/30'
      }`}
      onClick={() => onActivate(segment.segmentId)}
    >
      <div className="px-0 py-1 border-r border-border bg-muted/50 flex items-start justify-center">
        <div className="mt-1 text-[9px] font-medium text-text-faint select-none">{rowNumber}</div>
      </div>

      <div
        className="px-2 py-2 border-r border-border bg-surface relative"
        onMouseEnter={() => setIsSourceHovered(true)}
        onMouseLeave={() => setIsSourceHovered(false)}
      >
        <div className="w-full min-h-[44px] px-1 pr-3 py-1 text-[14px] font-sans text-text-muted leading-relaxed whitespace-pre-wrap break-words select-text">
          {renderChunks(sourceHighlightChunks)}
        </div>
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

      <div
        className="relative border-r border-border overflow-visible bg-gradient-to-b from-transparent via-gray-100/40 to-transparent"
        title={statusTitle}
      >
        <div className="absolute left-1/2  -translate-x-1/2 w-[4px]  bg-border/50" />
        <div
          className={`absolute left-1/2 top-0.5 bottom-0.5 -translate-x-1/2 w-[4px] ${statusLine}`}
        />
      </div>

      <div
        className={`px-2 py-2 relative ${
          hasError ? 'bg-danger-soft/40' : hasWarning ? 'bg-warning-soft/35' : 'bg-surface'
        } ${isActive ? 'ring-1 ring-inset ring-brand/50' : ''}`}
      >
        <textarea
          ref={textareaRef}
          value={draftText}
          readOnly={!isActive}
          onFocus={() => onActivate(segment.segmentId)}
          onChange={(e) => emitTranslationChange(e.target.value)}
          onKeyDown={handleTargetKeyDown}
          onDoubleClick={(e) => e.currentTarget.select()}
          spellCheck={false}
          className={`relative z-10 w-full min-h-[44px] px-3 py-3 text-[14px] font-sans leading-relaxed bg-transparent outline-none resize-none overflow-hidden whitespace-pre-wrap break-words text-text ${
            !isActive ? 'pointer-events-none' : ''
          } ${!isActive ? 'caret-transparent' : ''}`}
        />

        {showTargetHighlightOverlay && (
          <div className="pointer-events-none absolute inset-0 px-3 py-3 text-[14px] font-sans text-transparent leading-relaxed whitespace-pre-wrap break-words select-none">
            {renderChunks(targetHighlightChunks)}
          </div>
        )}

        {isActive && sourceTags.length > 0 && (
          <div className="absolute top-2 right-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTagInsertionUI(!showTagInsertionUI);
              }}
              className="p-1 rounded bg-surface/75 border border-border/80 hover:bg-brand-soft/80 hover:border-brand/40 text-text-muted hover:text-brand transition-all shadow-sm"
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
          </div>
        )}

        <TagInsertionUI
          sourceTags={sourceTags}
          onInsertTag={handleInsertTag}
          onInsertAllTags={handleInsertAllTags}
          isVisible={isActive && showTagInsertionUI}
        />

        {qaIssues.length > 0 && (
          <div className="mt-2 space-y-1">
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
          <div className="mt-2 text-[10px] flex items-center gap-1.5 px-2 py-0.5 rounded bg-danger-soft text-danger">
            <span className="font-bold uppercase text-[8px]">save:</span>
            {saveError}
          </div>
        )}

        {segment.meta?.context && (
          <div className="mt-2 px-1 flex flex-col group">
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
