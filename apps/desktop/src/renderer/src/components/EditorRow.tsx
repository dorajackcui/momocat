import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Segment, Token, formatTagAsMemoQMarker, serializeTokensToEditorText } from '@cat/core';
import { TagInsertionUI } from './TagInsertionUI';

interface EditorRowProps {
  segment: Segment;
  rowNumber: number;
  isActive: boolean;
  onActivate: (id: string) => void;
  onChange: (id: string, value: string) => void;
  onConfirm: (id: string) => void;
}

export const EditorRow: React.FC<EditorRowProps> = ({
  segment,
  rowNumber,
  isActive,
  onActivate,
  onChange,
  onConfirm
}) => {
  const sourceTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [showTagInsertionUI, setShowTagInsertionUI] = useState(false);
  const [draftText, setDraftText] = useState('');

  const qaIssues = segment.qaIssues || [];
  const hasError = qaIssues.some(issue => issue.severity === 'error');
  const hasWarning = qaIssues.some(issue => issue.severity === 'warning');

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
    () => serializeTokensToEditorText(segment.sourceTokens, segment.sourceTokens).replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
    [segment.sourceTokens]
  );

  const targetEditorText = useMemo(
    () => serializeTokensToEditorText(segment.targetTokens, segment.sourceTokens).replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
    [segment.targetTokens, segment.sourceTokens]
  );

  const resizeTextarea = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(40, el.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    setDraftText(targetEditorText);
  }, [targetEditorText, segment.segmentId]);

  useEffect(() => {
    if (isActive && textareaRef.current) {
      textareaRef.current.focus();
    }
    if (!isActive) {
      setShowTagInsertionUI(false);
    }
  }, [isActive]);

  useEffect(() => {
    resizeTextarea(sourceTextareaRef.current);
  }, [sourceEditorText, resizeTextarea]);

  useEffect(() => {
    resizeTextarea(textareaRef.current);
  }, [draftText, resizeTextarea]);

  const emitTranslationChange = useCallback(
    (nextText: string) => {
      setDraftText(nextText);
      onChange(segment.segmentId, nextText);
      requestAnimationFrame(() => resizeTextarea(textareaRef.current));
    },
    [onChange, segment.segmentId, resizeTextarea]
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
    [emitTranslationChange]
  );

  const handleInsertTag = useCallback(
    (tagIndex: number) => {
      if (tagIndex < 0 || tagIndex >= sourceTags.length) return;
      const marker = formatTagAsMemoQMarker(sourceTags[tagIndex].content, tagIndex + 1);
      insertAtSelection(marker);
      setShowTagInsertionUI(false);
    },
    [insertAtSelection, sourceTags]
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

  const statusColor =
    hasError ? 'bg-red-500' :
    hasWarning ? 'bg-amber-400' :
    segment.status === 'confirmed' ? 'bg-green-500' :
    segment.status === 'draft' ? 'bg-yellow-400' :
    'bg-gray-200';

  const statusTitle = hasError
    ? `Status: ${segment.status} (QA error)`
    : hasWarning
      ? `Status: ${segment.status} (QA warning)`
      : `Status: ${segment.status}`;

  const contextText = segment.meta?.context || '';
  const isLongContext = contextText.length > 120;
  const displayContext = isContextExpanded || !isLongContext
    ? contextText
    : `${contextText.substring(0, 110)}...`;

  return (
    <div
      className={`grid grid-cols-[1fr_32px_4px_1fr] border-b border-gray-100 transition-all ${
        isActive ? 'bg-blue-50/40' : 'hover:bg-gray-50/50'
      } ${hasError ? 'border-l-4 border-l-red-500' : hasWarning ? 'border-l-4 border-l-yellow-400' : ''}`}
      onClick={() => onActivate(segment.segmentId)}
    >

      <div className="p-4 border-r border-gray-100">
        <div className="mb-2 text-[10px] text-gray-400">{rowNumber}</div>
        <textarea
          ref={sourceTextareaRef}
          value={sourceEditorText}
          readOnly
          spellCheck={false}
          className="w-full min-h-[40px] p-2 text-sm text-gray-700 rounded-md border border-transparent bg-transparent leading-relaxed resize-none overflow-hidden select-text cursor-text focus:outline-none"
        />
      </div>

      <div className="flex flex-col items-center justify-center border-r border-gray-100 py-4">
        <button
          onClick={handleCopySourceToTarget}
          className={`p-1.5 rounded-md hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-all ${
            isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          title="Copy Source to Target"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className={`w-1 h-full ${statusColor}`} title={statusTitle} />

      <div className="p-4 relative">
        <textarea
          ref={textareaRef}
          value={draftText}
          onFocus={() => onActivate(segment.segmentId)}
          onChange={(e) => emitTranslationChange(e.target.value)}
          onKeyDown={handleTargetKeyDown}
          onDoubleClick={(e) => e.currentTarget.select()}
          spellCheck={false}
          className={`w-full min-h-[40px] p-2 text-sm rounded-md border focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none overflow-hidden whitespace-pre-wrap ${
            isActive ? 'border-blue-300 bg-white shadow-sm' : 'border-transparent bg-transparent hover:border-gray-200'
          } ${hasError ? 'ring-1 ring-red-200 border-red-300' : ''}`}
        />

        {isActive && sourceTags.length > 0 && (
          <div className="absolute top-2 right-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTagInsertionUI(!showTagInsertionUI);
              }}
              className="p-1.5 rounded-md bg-white border border-gray-300 hover:bg-blue-50 hover:border-blue-400 text-gray-600 hover:text-blue-600 transition-all shadow-sm"
              title="Insert tags from source (Ctrl+Shift+1-9)"
              aria-label="Toggle tag insertion menu"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
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
                  issue.severity === 'error' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-700'
                }`}
              >
                <span className="font-bold uppercase text-[8px]">{issue.severity}:</span>
                {issue.message}
              </div>
            ))}
          </div>
        )}

        {segment.meta?.context && (
          <div className="mt-2 px-1 flex flex-col group">
            <div className="text-[11px] text-gray-400 italic leading-snug">
              {displayContext}
              {isLongContext && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsContextExpanded(!isContextExpanded);
                  }}
                  className="ml-1 text-blue-500 hover:text-blue-700 font-medium not-italic"
                >
                  {isContextExpanded ? 'Collapse' : 'more'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
