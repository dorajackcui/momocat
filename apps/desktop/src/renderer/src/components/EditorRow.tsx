import React, { useRef, useEffect, useState } from 'react';
import { Segment, serializeTokensToDisplayText, Token, validateSegmentTags } from '@cat/core';

interface EditorRowProps {
  segment: Segment;
  isActive: boolean;
  onActivate: (id: string) => void;
  onChange: (id: string, value: string) => void;
  onConfirm: (id: string) => void;
}

export const EditorRow: React.FC<EditorRowProps> = ({
  segment,
  isActive,
  onActivate,
  onChange,
  onConfirm,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const qaIssues = validateSegmentTags(segment);
  const hasError = qaIssues.some(issue => issue.severity === 'error');
  const hasWarning = qaIssues.some(issue => issue.severity === 'warning');

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [segment.targetTokens, isActive]);

  useEffect(() => {
    if (isActive && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isActive]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onConfirm(segment.segmentId);
    }
  };

  const insertTag = (tag: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const currentText = serializeTokensToDisplayText(segment.targetTokens);
    const newText = currentText.substring(0, start) + tag + currentText.substring(end);
    
    onChange(segment.segmentId, newText);
    
    // Reset focus and cursor position after state update
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPos = start + tag.length;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleCopySource = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = serializeTokensToDisplayText(segment.sourceTokens);
    onChange(segment.segmentId, text);
  };

  const targetText = serializeTokensToDisplayText(segment.targetTokens);

  // Minimalist status bar color
  const statusColor = 
    segment.status === 'confirmed' ? 'bg-green-500' :
    segment.status === 'draft' ? 'bg-yellow-400' :
    'bg-gray-200';

  const contextText = segment.meta?.context || '';
  const isLongContext = contextText.length > 120;
  const displayContext = isContextExpanded || !isLongContext 
    ? contextText 
    : contextText.substring(0, 110) + '...';

  return (
    <div 
      className={`grid grid-cols-[1fr_32px_4px_1fr] border-b border-gray-100 transition-all ${
        isActive ? 'bg-blue-50/40' : 'hover:bg-gray-50/50'
      } ${hasError ? 'border-l-4 border-l-red-500' : hasWarning ? 'border-l-4 border-l-yellow-400' : ''}`}
      onClick={() => onActivate(segment.segmentId)}
    >
      <div className="p-4 border-r border-gray-100">
        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
          {segment.sourceTokens.map((token, i) => (
            token.type === 'tag' ? (
              <TokenCapsule 
                key={i} 
                token={token} 
                onClick={() => insertTag(token.content)} 
                interactive={isActive}
              />
            ) : (
              <span key={i}>{token.content}</span>
            )
          ))}
        </div>
      </div>

      {/* Middle Action Column */}
      <div className="flex flex-col items-center justify-center border-r border-gray-100 py-4">
        <button
          onClick={handleCopySource}
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

      {/* Minimalist Status Indicator Bar (Left of Translation Box) */}
      <div className={`w-1 h-full ${statusColor}`} title={`Status: ${segment.status}`} />
      
      <div className="p-4 relative">
        <textarea
          ref={textareaRef}
          className={`w-full min-h-[40px] p-2 text-sm rounded-md border focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none overflow-hidden ${
            isActive ? 'border-blue-300 bg-white shadow-sm' : 'border-transparent bg-transparent hover:border-gray-200'
          } ${hasError ? 'ring-1 ring-red-200 border-red-300' : ''}`}
          value={targetText}
          onChange={(e) => onChange(segment.segmentId, e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder=""
        />
        
        {/* QA Issues Display */}
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

const TokenCapsule: React.FC<{ 
  token: Token; 
  onClick?: () => void;
  interactive?: boolean;
}> = ({ token, onClick, interactive }) => {
  if (token.type === 'text') return null;
  return (
    <span 
      onClick={(e) => {
        if (interactive && onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      className={`inline-block px-1.5 py-0.5 mx-0.5 text-[10px] font-mono rounded border select-none transition-all ${
        interactive 
          ? 'bg-purple-100 text-purple-700 border-purple-200 cursor-pointer hover:bg-purple-200 hover:scale-105 active:scale-95' 
          : 'bg-gray-100 text-gray-500 border-gray-200 cursor-default'
      }`}
      title={interactive ? "Click to insert into target" : ""}
    >
      {token.content}
    </span>
  );
};
