import React from 'react';
import { Segment } from '@cat/core';

interface ProgressBarProps {
  segments: Segment[];
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ segments }) => {
  const total = segments.length;
  const completed = segments.filter((s) => s.status === 'confirmed').length;
  const draft = segments.filter((s) => s.status === 'draft').length;
  
  const completedPct = total === 0 ? 0 : (completed / total) * 100;
  const draftPct = total === 0 ? 0 : (draft / total) * 100;

  return (
    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col gap-2">
      <div className="flex justify-between items-center text-xs font-medium text-gray-500">
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Confirmed: {completed}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            Draft: {draft}
          </span>
        </div>
        <span>Total: {total}</span>
      </div>
      
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-green-500 transition-all duration-500"
          style={{ width: `${completedPct}%` }}
        />
        <div
          className="h-full bg-yellow-400 transition-all duration-500"
          style={{ width: `${draftPct}%` }}
        />
      </div>
    </div>
  );
};
