import React, { useCallback, useEffect, useRef, useState } from 'react';
import { serializeTokensToDisplayText } from '@cat/core';
import { apiClient } from '../services/apiClient';
import type { TMConcordanceEntry } from '../../../shared/ipc';

interface ConcordancePanelProps {
  projectId: number;
  focusSignal?: number;
  externalQuery?: string;
  searchSignal?: number;
}

export const ConcordancePanel: React.FC<ConcordancePanelProps> = ({
  projectId,
  focusSignal = 0,
  externalQuery = '',
  searchSignal = 0,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TMConcordanceEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(
    async (rawQuery: string) => {
      const trimmedQuery = rawQuery.trim();
      if (!trimmedQuery) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const data = await apiClient.searchConcordance(projectId, trimmedQuery);
        setResults(data);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.focus();
    inputRef.current.select();
  }, [focusSignal]);

  useEffect(() => {
    if (searchSignal <= 0) return;
    const trimmedQuery = externalQuery.trim();
    if (!trimmedQuery) return;

    setQuery(trimmedQuery);
    void runSearch(trimmedQuery);
  }, [externalQuery, runSearch, searchSignal]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await runSearch(query);
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 w-80">
      <div className="p-4 border-b border-gray-100 bg-gray-50/50">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
          Concordance Search
        </h3>
        <form onSubmit={handleSearch} className="relative">
          <input
            ref={inputRef}
            type="text"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            placeholder="Search TM..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isSearching ? (
          <div className="text-center py-8 text-gray-400 text-xs italic">Searching...</div>
        ) : results.length > 0 ? (
          results.map((entry) => (
            <div key={entry.id} className="group border-b border-gray-50 pb-4 last:border-0">
              <div className="text-[13px] text-gray-700 mb-1.5 leading-snug">
                {serializeTokensToDisplayText(entry.sourceTokens)}
              </div>
              <div className="text-[13px] text-blue-600 leading-snug italic">
                {serializeTokensToDisplayText(entry.targetTokens)}
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1 py-0.5 rounded-[3px] font-bold uppercase text-[8px] ${entry.tmType === 'working' ? 'bg-blue-50 text-blue-500' : 'bg-purple-50 text-purple-500'}`}
                  >
                    {entry.tmType === 'working' ? 'Working' : entry.tmName}
                  </span>
                  <span>Used {entry.usageCount} times</span>
                </div>
                <button className="text-blue-500 hover:underline opacity-0 group-hover:opacity-100 transition-opacity">
                  Apply
                </button>
              </div>
            </div>
          ))
        ) : query ? (
          <div className="text-center py-8 text-gray-400 text-xs">
            No matches found for &quot;{query}&quot;
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 text-xs italic">
            Enter keywords to search across project memory.
          </div>
        )}
      </div>
    </div>
  );
};
