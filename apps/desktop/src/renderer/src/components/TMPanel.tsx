import React from 'react';
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
  if (!matches || matches.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 p-6 text-center">
        <div className="mb-2 text-2xl">🔍</div>
        <p className="text-xs">No translation memory matches found for the current segment.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        {/* <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Translation Memory</h3> */}
        <span className="text-[10px] text-gray-400">{matches.length} matches found</span>
      </div>

      <div className="space-y-4">
        {matches.map((match, idx) => {
          const tmLabel = match.tmType === 'working' ? 'Working TM' : `Main TM: ${match.tmName}`;
          const similarityColor = match.similarity === 100 ? 'text-green-600' : 
                                match.similarity >= 90 ? 'text-blue-600' : 
                                'text-orange-600';

          return (
            <div key={match.id + idx} className="group border border-gray-100 rounded-xl overflow-hidden hover:border-blue-200 hover:shadow-sm transition-all bg-white">
              <div className="px-3 py-2 bg-gray-50/50 flex items-center justify-between border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${match.tmType === 'working' ? 'text-blue-700' : 'text-purple-700'}`}>
                    {tmLabel}
                  </span>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${similarityColor}`}>
                  {match.similarity}% Match
                </span>
              </div>

              <div className="p-3 space-y-2">
                <button
                  onClick={() => onApply(match.targetTokens)}
                  className="w-full mt-2 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white text-[10px] font-bold rounded-lg transition-all border border-blue-100 hover:border-blue-600"
                >
                  Apply Match
                </button>
                <div className="space-y-1">
                  <div className="text-[9px] text-gray-400 uppercase font-bold tracking-tight">Source</div>
                  <div className="text-xs text-gray-600 leading-snug">{serializeTokensToDisplayText(match.sourceTokens)}</div>
                </div>

                <div className="space-y-1">
                  <div className="text-[9px] text-blue-400 uppercase font-bold tracking-tight">Target</div>
                  <div className="text-xs text-gray-800 leading-snug font-medium italic">{serializeTokensToDisplayText(match.targetTokens)}</div>
                </div>
              </div>

              <div className="px-3 py-1.5 bg-gray-50/30 flex justify-between items-center text-[9px] text-gray-400 border-t border-gray-50">
                <span>Used {match.usageCount} times</span>
                <span>{new Date(match.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
