import React, { useRef, useEffect } from 'react';
import { Segment, serializeTokensToDisplayText, Token } from '@cat/core';

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

  const targetText = serializeTokensToDisplayText(segment.targetTokens);

  return (
    <div 
      className={`grid grid-cols-2 border-b border-gray-100 transition-colors ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
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
      
      <div className="p-4 relative">
        <textarea
          ref={textareaRef}
          className={`w-full min-h-[40px] p-3 text-sm rounded-lg border focus:ring-2 focus:ring-blue-200 outline-none transition-all resize-none overflow-hidden ${
            isActive ? 'border-blue-400 bg-white shadow-sm' : 'border-gray-200 bg-transparent'
          }`}
          value={targetText}
          onChange={(e) => onChange(segment.segmentId, e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Translate here..."
        />
        
        {segment.meta?.context && (
          <div className="mt-2 px-1 flex items-start gap-1.5 group">
            <svg className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            <span className="text-[11px] text-gray-500 italic leading-snug">
              {segment.meta.context}
            </span>
          </div>
        )}

        <div className="mt-3 flex justify-between items-center">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
            segment.status === 'confirmed' ? 'bg-green-100 text-green-700' :
            segment.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-500'
          }`}>
            {segment.status}
          </span>
          {isActive && (
            <span className="text-[10px] text-gray-400">Ctrl + Enter to confirm</span>
          )}
        </div>
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
