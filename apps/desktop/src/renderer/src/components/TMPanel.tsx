import React from 'react';
import { TMEntry, serializeTokensToDisplayText } from '@cat/core';

interface TMPanelProps {
  match: TMEntry | null;
  onApply: (tokens: any[]) => void;
}

export const TMPanel: React.FC<TMPanelProps> = ({ match, onApply }) => {
  if (!match) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 p-6 text-center">
        <div className="mb-2 text-2xl">🔍</div>
        <p className="text-xs">No translation memory matches found for the current segment.</p>
      </div>
    );
  }

  const tmLabel = (match as any).tmType === 'working' ? 'Working TM' : `Main TM: ${(match as any).tmName}`;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Translation Memory</h3>
        <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-bold">100% Match</span>
      </div>

      <div className="flex items-center gap-2">
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${(match as any).tmType === 'working' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
          {tmLabel}
        </span>
      </div>

      <div className="space-y-3">
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <div className="text-[11px] text-gray-400 mb-1 uppercase font-medium">Source</div>
          <div className="text-sm text-gray-700">{serializeTokensToDisplayText(match.sourceTokens)}</div>
        </div>

        <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100">
          <div className="text-[11px] text-blue-400 mb-1 uppercase font-medium">Target</div>
          <div className="text-sm text-gray-800">{serializeTokensToDisplayText(match.targetTokens)}</div>
        </div>
      </div>

      <button
        onClick={() => onApply(match.targetTokens)}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
      >
        Apply Match
      </button>

      <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400">
        <span>Used {match.usageCount} times</span>
        <span>Updated {new Date(match.updatedAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
};
