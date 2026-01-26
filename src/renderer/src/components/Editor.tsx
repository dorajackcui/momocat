import React from 'react';
import { ProjectFile } from '../types';
import { EditorRow } from './EditorRow';
import { ProgressBar } from './ProgressBar';
import { TMPanel } from './TMPanel';
import { ColumnSelector } from './ColumnSelector';
import { useEditor } from '../hooks/useEditor';
import { useTM } from '../hooks/useTM';

interface EditorProps {
  activeFileId: number;
  files: ProjectFile[];
  onBack: () => void;
  onProgressUpdate: (id: number, progress: number) => void;
}

export function Editor({ activeFileId, files, onBack, onProgressUpdate }: EditorProps) {
  const tmRef = React.useRef<{ updateTM: (s: string, t: string) => Promise<void> } | null>(null);

  const handleUpdateTM = async (source: string, target: string) => {
    if (tmRef.current) {
      await tmRef.current.updateTM(source, target);
    }
  };

  const {
    segments,
    activeSegmentId,
    originalFilePath,
    showColSelector,
    rawGridData,
    handleColumnConfirm,
    handleTranslationChange,
    handleActivate,
    handleNext,
    handlePrev,
    handleExport,
    setShowColSelector,
    getActiveSegmentSource,
  } = useEditor({
    activeFileId,
    files,
    onProgressUpdate,
    onUpdateTM: handleUpdateTM,
  });

  const activeSource = getActiveSegmentSource();

  const { matches, loading: isTmLoading, updateTM, importTM } = useTM(activeSource);

  tmRef.current = { updateTM };

  const handleApplyTM = (target: string) => {
    if (activeSegmentId !== null) {
      handleTranslationChange(activeSegmentId, target);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {showColSelector && (
        <ColumnSelector
          headers={rawGridData[0] || []}
          previewData={rawGridData.slice(1, 6)}
          onConfirm={handleColumnConfirm}
          onCancel={() => {
            setShowColSelector(false);
            onBack();
          }}
        />
      )}

      <header className="px-5 py-2.5 border-b border-gray-200 flex justify-between items-center bg-white z-10">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="mr-4 px-2.5 py-1.5 border border-gray-300 bg-white rounded cursor-pointer hover:bg-gray-50 transition-colors"
          >
            ← Back
          </button>
          <h1 className="m-0 text-lg font-normal">
            {files.find((f) => f.id === activeFileId)?.name || 'Editor'}
          </h1>
        </div>
        <div>
          <button
            onClick={handleExport}
            className="px-3 py-1.5 bg-green-500 text-white border-none rounded cursor-pointer hover:bg-green-600 transition-colors"
          >
            Export
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col p-5 overflow-y-auto min-h-0 bg-white">
          {originalFilePath && (
            <div className="mb-4 text-gray-500 text-xs">Source: {originalFilePath}</div>
          )}

          {segments.length > 0 && <ProgressBar segments={segments} />}

          {segments.length > 0 && (
            <div className="grid grid-cols-2 border border-gray-300 rounded overflow-hidden">
              <div className="font-bold bg-gray-50 p-2.5 border-b border-gray-300">Source Text</div>
              <div className="font-bold bg-gray-50 p-2.5 border-b border-gray-300">Target Text</div>

              {segments.map((segment) => (
                <EditorRow
                  key={segment.id}
                  segment={segment}
                  isActive={segment.id === activeSegmentId}
                  onActivate={handleActivate}
                  onChange={handleTranslationChange}
                  onNext={handleNext}
                  onPrev={handlePrev}
                />
              ))}
            </div>
          )}

          {segments.length > 0 && (
            <div className="mt-5 text-gray-400 text-xs text-center">
              Tips: Use <b>Cmd/Ctrl + Enter</b> to confirm and jump to next segment.
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="w-[300px] flex-shrink-0 border-l border-gray-200 bg-gray-50">
          <TMPanel matches={matches} loading={isTmLoading} onApply={handleApplyTM} />
        </div>
      </div>
    </div>
  );
}
