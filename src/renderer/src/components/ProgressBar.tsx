import React from 'react';
import { Segment } from '../types';

interface ProgressBarProps {
  segments: Segment[];
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ segments }) => {
  const total = segments.length;
  const completed = segments.filter((s) => s.target.trim().length > 0).length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div
      style={{
        marginBottom: '20px',
        padding: '10px',
        backgroundColor: '#f0f2f5',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            height: '8px',
            backgroundColor: '#d9d9d9',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${percentage}%`,
              height: '100%',
              backgroundColor: '#52c41a',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>
      <div style={{ fontSize: '14px', color: '#666', minWidth: '120px', textAlign: 'right' }}>
        {completed} / {total} ({percentage}%)
      </div>
    </div>
  );
};
