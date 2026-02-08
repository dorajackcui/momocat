import React, { useState } from 'react';
import { TMEntry, serializeTokensToDisplayText } from '@cat/core';

interface TMMatch extends TMEntry {
  similarity: number;
  tmName: string;
  tmType: 'working' | 'main';
}

interface TMPanelProps {
  matches: TMMatch[];
  onApply: (tokens: any[]) => void;
}

export const TMPanel: React.FC<TMPanelProps> = ({ matches, onApply }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const truncate = (text: string, limit: number) => {
    if (text.length <= limit) return text;
    return `${text.slice(0, limit)}...`;
  };

  const toggleExpanded = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (!matches || matches.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 p-6 text-center">
        <div className="mb-2 text-2xl">🔍</div>
        <p className="text-xs">No translation memory matches found for the current segment.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-2 py-2 border-b border-gray-100">
        <span className="text-[10px] text-gray-400">{matches.length} matches found</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {matches.map((match, idx) => {
          const tmLabel = match.tmType === 'working' ? 'Working TM' : `Main TM: ${match.tmName}`;
          const scoreBg =
            match.similarity >= 95 ? 'bg-emerald-600' :
            match.similarity >= 85 ? 'bg-blue-600' :
            'bg-amber-600';
          const key = `${match.id}-${idx}`;
          const sourceText = serializeTokensToDisplayText(match.sourceTokens);
          const targetText = serializeTokensToDisplayText(match.targetTokens);
          const isExpanded = !!expanded[key];
          const hasLongSource = sourceText.length > 180;
          const hasLongTarget = targetText.length > 180;

          return (
            <div key={match.id + idx} className="border-b border-gray-100 last:border-b-0">
              <div className="px-2 py-1 flex items-center justify-between text-[9px] text-gray-400 bg-gray-50/40">
                <span className="truncate">{tmLabel}</span>
                <span>Used {match.usageCount} · {new Date(match.updatedAt).toLocaleDateString()}</span>
              </div>

              <div
                className="group grid grid-cols-[1fr_20px_1fr] items-stretch cursor-pointer hover:bg-blue-50/30 transition-colors"
                onDoubleClick={() => onApply(match.targetTokens)}
                title="Double click to apply match"
              >
                <div className="px-2 py-2 border-r border-gray-100 text-xs text-gray-600 leading-snug">
                  {isExpanded ? sourceText : truncate(sourceText, 170)}
                  {hasLongSource && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(key);
                      }}
                      className="ml-1 text-[10px] text-blue-500 hover:underline"
                    >
                      {isExpanded ? 'less' : '...'}
                    </button>
                  )}
                </div>

                <div className={`${scoreBg} text-white flex items-center justify-center px-[1px]`}>
                  <span className="text-[8px] font-bold leading-none whitespace-nowrap">{match.similarity}</span>
                </div>

                <div className="px-2 py-2 border-l border-gray-100 text-xs text-gray-800 leading-snug">
                  {isExpanded ? targetText : truncate(targetText, 300)}
                  {hasLongTarget && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(key);
                      }}
                      className="ml-1 text-[10px] text-blue-500 hover:underline not-italic"
                    >
                      {isExpanded ? 'less' : '...'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
