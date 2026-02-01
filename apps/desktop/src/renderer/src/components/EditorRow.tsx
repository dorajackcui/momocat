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

  const sourceText = serializeTokensToDisplayText(segment.sourceTokens);
  const targetText = serializeTokensToDisplayText(segment.targetTokens);

  return (
    <div 
      className={`grid grid-cols-2 border-b border-gray-100 transition-colors ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
      onClick={() => onActivate(segment.segmentId)}
    >
      <div className="p-4 border-r border-gray-100">
        <div className="flex flex-wrap gap-1 mb-2">
          {segment.sourceTokens.map((token, i) => (
            <TokenCapsule key={i} token={token} />
          ))}
        </div>
        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
          {sourceText}
        </div>
      </div>
      
      <div className="p-4 relative">
        <textarea
          ref={textareaRef}
          className={`w-full min-h-[80px] p-3 text-sm rounded-lg border focus:ring-2 focus:ring-blue-200 outline-none transition-all resize-none ${
            isActive ? 'border-blue-400 bg-white' : 'border-gray-200 bg-transparent'
          }`}
          value={targetText}
          onChange={(e) => onChange(segment.segmentId, e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Translate here..."
        />
        <div className="mt-2 flex justify-between items-center">
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

const TokenCapsule: React.FC<{ token: Token }> = ({ token }) => {
  if (token.type === 'text') return null;
  return (
    <span className="inline-block px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-mono rounded border border-purple-200 select-none">
      {token.content}
    </span>
  );
};
