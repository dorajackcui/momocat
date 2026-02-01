import React, { useState, useEffect } from 'react';
import { Project, ProjectFile } from '@cat/core';
import { EditorRow } from './EditorRow';
import { ProgressBar } from './ProgressBar';
import { useEditor } from '../hooks/useEditor';

interface EditorProps {
  activeFileId: number;
  onBack: () => void;
}

export function Editor({ activeFileId, onBack }: EditorProps) {
  const [file, setFile] = useState<ProjectFile | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  const {
    segments,
    activeSegmentId,
    setActiveSegmentId,
    loading,
    handleTranslationChange,
    confirmSegment,
  } = useEditor({
    activeFileId,
  });

  useEffect(() => {
    const loadInfo = async () => {
      try {
        const f = await window.api.getFile(activeFileId); // Need to add getFile to preload
        if (f) {
          setFile(f);
          const p = await window.api.getProject(f.projectId);
          setProject(p);
        }
      } catch (e) {
        console.error('Failed to load file info', e);
      }
    };
    loadInfo();
  }, [activeFileId]);

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50">
      <header className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
            title="Back to Project"
          >
            ←
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              {file?.name || 'Editor'}
            </h1>
            <div className="text-[10px] text-gray-500 flex gap-2">
              <span className="font-bold text-blue-600">{project?.name}</span>
              <span>•</span>
              <span>Source: {project?.srcLang}</span>
              <span>•</span>
              <span>Target: {project?.tgtLang}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          {/* Future actions: Search, Replace, QA */}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col p-6 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              Loading segments...
            </div>
          ) : (
            <>
              <ProgressBar segments={segments} />
              
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="grid grid-cols-2 bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <div className="p-3 border-r border-gray-200">Source Text</div>
                  <div className="p-3">Target Text</div>
                </div>

                {segments.map((segment) => (
                  <EditorRow
                    key={segment.segmentId}
                    segment={segment}
                    isActive={segment.segmentId === activeSegmentId}
                    onActivate={setActiveSegmentId}
                    onChange={handleTranslationChange}
                    onConfirm={confirmSegment}
                  />
                ))}
              </div>

              <div className="mt-8 text-center text-xs text-gray-400">
                End of document.
              </div>
            </>
          )}
        </div>

        {/* Right Panel (Reserved for TM/TB/QA in v0.2+) */}
        <div className="w-[300px] flex-shrink-0 border-l border-gray-200 bg-white p-6 hidden lg:block">
          <div className="text-sm font-bold text-gray-900 mb-4">Resources</div>
          <div className="text-xs text-gray-400 italic">
            Translation Memory and Terminology will appear here in v0.2.
          </div>
        </div>
      </div>
    </div>
  );
}
