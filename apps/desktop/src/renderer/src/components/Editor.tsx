import React, { useState, useEffect } from 'react';
import { Project, ProjectFile } from '@cat/core';
import { EditorRow } from './EditorRow';
import { useEditor } from '../hooks/useEditor';
import { TMPanel } from './TMPanel';
import { ConcordancePanel } from './ConcordancePanel';

interface EditorProps {
  fileId: number;
  onBack: () => void;
}

export const Editor: React.FC<EditorProps> = ({ fileId, onBack }) => {
  const [activeTab, setActiveTab] = useState<'tm' | 'concordance'>('tm');
  const [file, setFile] = useState<ProjectFile | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  const { 
    segments, 
    activeSegmentId, 
    activeMatches,
    loading, 
    setActiveSegmentId, 
    handleTranslationChange,
    confirmSegment,
    handleApplyMatch,
    projectId
  } = useEditor({ activeFileId: fileId });

  const totalSegments = segments.length;
  const confirmedSegments = segments.filter((s) => s.status === 'confirmed').length;

  useEffect(() => {
    const loadInfo = async () => {
      try {
        const f = await window.api.getFile(fileId);
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
  }, [fileId]);

  const handleExport = async () => {
    if (!file) return;
    
    const defaultPath = file.name.replace(/(\.xlsx|\.csv)$/i, '_translated$1');
    const outputPath = await window.api.saveFileDialog(defaultPath, [
      { name: 'Spreadsheets', extensions: ['xlsx', 'csv'] }
    ]);

    if (outputPath) {
      try {
        await window.api.exportFile(fileId, outputPath);
        alert('Export successful');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Check if this is a QA error that can be forced
        if (errorMessage.includes('Export blocked by QA errors')) {
          const forceExport = confirm(
            `${errorMessage}\n\nDo you want to force export despite these errors?`
          );
          
          if (forceExport) {
            try {
              await window.api.exportFile(fileId, outputPath, undefined, true);
              alert('Export successful (forced despite QA errors)');
            } catch (forceError) {
              alert('Export failed: ' + (forceError instanceof Error ? forceError.message : String(forceError)));
            }
          }
        } else {
          alert('Export failed: ' + errorMessage);
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 text-gray-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading segments...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Editor Header */}
      <header className="px-6 py-3 border-b border-gray-200 flex justify-between items-center bg-white shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
            title="Back to Project"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h2 className="text-sm font-bold text-gray-900 leading-tight">
              {file?.name || 'Loading...'}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">{project?.name}</span>
              <span className="text-[10px] text-gray-300">•</span>
              <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{project?.srcLang} → {project?.tgtLang}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Progress</span>
            <div className="px-2.5 py-1 bg-gray-100 rounded-md text-[11px] font-bold text-gray-700">
              {confirmedSegments}/{totalSegments}
            </div>
          </div>
          <div className="h-4 w-[1px] bg-gray-200" />
          <button 
            onClick={handleExport}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all active:scale-95"
          >
            Export
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Main Editor Area */}
        <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
          <div className="min-w-[800px]">
            {/* Column Headers */}
            <div className="grid grid-cols-2 bg-gray-50/80 border-b border-gray-200 px-4 py-2 sticky top-0 z-10 backdrop-blur-sm">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2">Source Text</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 border-l border-gray-200">Target Translation</div>
            </div>
            
            {segments.map((segment, index) => (
              <EditorRow
                key={segment.segmentId}
                segment={segment}
                rowNumber={segment.meta?.rowRef || index + 1}
                isActive={segment.segmentId === activeSegmentId}
                onActivate={setActiveSegmentId}
                onChange={handleTranslationChange}
                onConfirm={confirmSegment}
              />
            ))}
            
            <div className="h-64 bg-gray-50/30" />
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 border-l border-gray-200 bg-gray-50/50 flex flex-col hidden lg:flex">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-white">
            <button
              onClick={() => setActiveTab('tm')}
              className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'tm' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              TM Match
            </button>
            <button
              onClick={() => setActiveTab('concordance')}
              className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'concordance' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Concordance
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'tm' ? (
              <TMPanel matches={activeMatches} onApply={handleApplyMatch} />
            ) : (
              <ConcordancePanel projectId={projectId || 0} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
