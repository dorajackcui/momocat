import React, { useEffect, useRef, useState } from 'react';
import { Project, ProjectFile } from '@cat/core';
import { EditorRow } from './EditorRow';
import { useEditor } from '../hooks/useEditor';
import { TMPanel } from './TMPanel';
import { ConcordancePanel } from './ConcordancePanel';
import { apiClient } from '../services/apiClient';
import { feedbackService } from '../services/feedbackService';
import {
  FILTER_MATCH_MODE_OPTIONS,
  FILTER_QUALITY_OPTIONS,
  FILTER_QUICK_PRESET_OPTIONS,
  FILTER_SORT_OPTIONS,
  FILTER_STATUS_OPTIONS,
  useEditorFilters,
} from '../hooks/useEditorFilters';

interface EditorProps {
  fileId: number;
  onBack: () => void;
}

export const Editor: React.FC<EditorProps> = ({ fileId, onBack }) => {
  const [activeTab, setActiveTab] = useState<'tm' | 'concordance'>('tm');
  const [concordanceFocusSignal, setConcordanceFocusSignal] = useState(0);
  const [concordanceSearchSignal, setConcordanceSearchSignal] = useState(0);
  const [concordanceQuery, setConcordanceQuery] = useState('');
  const [file, setFile] = useState<ProjectFile | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);

  const SIDEBAR_MIN_WIDTH = 220;

  const {
    segments,
    activeSegmentId,
    activeMatches,
    activeTerms,
    segmentSaveErrors,
    loading,
    setActiveSegmentId,
    handleTranslationChange,
    confirmSegment,
    handleApplyMatch,
    handleApplyTerm,
    projectId,
  } = useEditor({ activeFileId: fileId });

  const totalSegments = segments.length;
  const confirmedSegments = segments.filter((s) => s.status === 'confirmed').length;
  const saveErrorCount = Object.keys(segmentSaveErrors).length;

  const {
    sourceQueryInput,
    targetQueryInput,
    matchMode,
    statusFilter,
    qualityFilters,
    quickPreset,
    sortBy,
    sortDirection,
    isFilterMenuOpen,
    isSortMenuOpen,
    filterMenuRef,
    sortMenuRef,
    filteredSegments,
    activeFilterCount,
    hasActiveFilter,
    toggleFilterMenu,
    toggleSortMenu,
    setSourceQueryInput,
    setTargetQueryInput,
    handleStatusFilterChange,
    handleMatchModeChange,
    toggleQualityFilter,
    applyQuickPreset,
    handleSortChange,
    clearFilters,
    debouncedSourceQuery,
    debouncedTargetQuery,
  } = useEditorFilters({
    fileId,
    segments,
    segmentSaveErrors,
    activeSegmentId,
    setActiveSegmentId,
  });

  useEffect(() => {
    const loadInfo = async () => {
      try {
        const f = await apiClient.getFile(fileId);
        if (f) {
          setFile(f);
          const p = await apiClient.getProject(f.projectId);
          setProject(p ?? null);
        }
      } catch (e) {
        console.error('Failed to load file info', e);
      }
    };
    loadInfo();
  }, [fileId]);

  useEffect(() => {
    const getSelectedTextForConcordance = (): string => {
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLInputElement
      ) {
        const start = activeElement.selectionStart ?? 0;
        const end = activeElement.selectionEnd ?? 0;
        if (end > start) {
          return activeElement.value.slice(start, end).replace(/\s+/g, ' ').trim();
        }
      }

      const fallbackSelection = window.getSelection()?.toString() ?? '';
      return fallbackSelection.replace(/\s+/g, ' ').trim();
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'k') return;
      e.preventDefault();
      const selectedText = getSelectedTextForConcordance();
      setActiveTab('concordance');
      setConcordanceFocusSignal((value) => value + 1);
      if (selectedText) {
        setConcordanceQuery(selectedText);
        setConcordanceSearchSignal((value) => value + 1);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (!isResizingSidebar) return;

    const onMouseMove = (event: MouseEvent) => {
      const layoutRect = layoutRef.current?.getBoundingClientRect();
      if (!layoutRect) return;

      const maxWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.floor(layoutRect.width / 3));
      const nextWidth = layoutRect.right - event.clientX;
      const clampedWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(nextWidth, maxWidth));
      setSidebarWidth(clampedWidth);
    };

    const onMouseUp = () => {
      setIsResizingSidebar(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingSidebar]);

  useEffect(() => {
    const clampSidebarByViewport = () => {
      const layoutWidth = layoutRef.current?.clientWidth;
      if (!layoutWidth) return;
      const maxWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.floor(layoutWidth / 3));
      setSidebarWidth((prev) => Math.max(SIDEBAR_MIN_WIDTH, Math.min(prev, maxWidth)));
    };

    clampSidebarByViewport();
    window.addEventListener('resize', clampSidebarByViewport);
    return () => window.removeEventListener('resize', clampSidebarByViewport);
  }, []);

  const handleExport = async () => {
    if (!file) return;

    const defaultPath = file.name.replace(/(\.xlsx|\.csv)$/i, '_translated$1');
    const outputPath = await apiClient.saveFileDialog(defaultPath, [
      { name: 'Spreadsheets', extensions: ['xlsx', 'csv'] },
    ]);

    if (outputPath) {
      try {
        await apiClient.exportFile(fileId, outputPath);
        feedbackService.success('Export successful');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check if this is a QA error that can be forced
        if (errorMessage.includes('Export blocked by QA errors')) {
          const forceExport = await feedbackService.confirm(
            `${errorMessage}\n\nDo you want to force export despite these errors?`,
          );

          if (forceExport) {
            try {
              await apiClient.exportFile(fileId, outputPath, undefined, true);
              feedbackService.success('Export successful (forced despite QA errors)');
            } catch (forceError) {
              feedbackService.error(
                `Export failed: ${forceError instanceof Error ? forceError.message : String(forceError)}`,
              );
            }
          }
        } else {
          feedbackService.error(`Export failed: ${errorMessage}`);
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>
          <div>
            <h2 className="text-sm font-bold text-gray-900 leading-tight">
              {file?.name || 'Loading...'}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">
                {project?.name}
              </span>
              <span className="text-[10px] text-gray-300">•</span>
              <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                {project?.srcLang} → {project?.tgtLang}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {saveErrorCount > 0 && (
            <div className="px-2.5 py-1 bg-red-50 border border-red-200 rounded-md text-[11px] font-bold text-red-700">
              {saveErrorCount} 段保存失败
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Progress
            </span>
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

      <div ref={layoutRef} className="flex-1 flex min-h-0">
        {/* Main Editor Area */}
        <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
          <div className="min-w-[800px]">
            <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50/80 backdrop-blur-sm">
                <div ref={sortMenuRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={toggleSortMenu}
                    className={`h-8 w-8 rounded-md border transition-colors ${
                      isSortMenuOpen || sortBy !== 'default'
                        ? 'bg-blue-50 text-blue-600 border-blue-200'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                    title="Sort options"
                    aria-label="Sort options"
                  >
                    <svg
                      className="w-4 h-4 mx-auto"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7h8M6 12h12M10 17h4"
                      />
                    </svg>
                  </button>

                  {sortBy !== 'default' && (
                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
                  )}

                  {isSortMenuOpen && (
                    <div className="absolute left-0 top-full mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg p-2 z-30 space-y-1">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Sort
                      </div>
                      {FILTER_SORT_OPTIONS.map((option) => {
                        const active =
                          sortBy === option.sortBy && sortDirection === option.sortDirection;
                        return (
                          <button
                            key={`${option.sortBy}-${option.sortDirection}`}
                            type="button"
                            onClick={() => handleSortChange(option.sortBy, option.sortDirection)}
                            className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] font-bold border transition-colors ${
                              active
                                ? 'bg-blue-50 text-blue-600 border-blue-200'
                                : 'bg-white text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <label className="relative flex-1 min-w-0">
                  <input
                    value={sourceQueryInput}
                    onChange={(e) => setSourceQueryInput(e.target.value)}
                    placeholder="Filter source text"
                    className="w-full rounded-xl border border-gray-200 bg-white pl-8 pr-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </span>
                </label>

                <label className="relative flex-1 min-w-0">
                  <input
                    value={targetQueryInput}
                    onChange={(e) => setTargetQueryInput(e.target.value)}
                    placeholder="Filter target text"
                    className="w-full rounded-xl border border-gray-200 bg-white pl-8 pr-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </span>
                </label>

                <div ref={filterMenuRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={toggleFilterMenu}
                    className={`h-8 w-8 rounded-md border transition-colors ${
                      isFilterMenuOpen || activeFilterCount > 0
                        ? 'bg-blue-50 text-blue-600 border-blue-200'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                    aria-label="Open filters"
                    title="Open filters"
                  >
                    <svg
                      className="w-4 h-4 mx-auto"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 4h18M6 12h12M10 20h4"
                      />
                    </svg>
                  </button>
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] text-white leading-none">
                      {activeFilterCount}
                    </span>
                  )}

                  {isFilterMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg p-3 z-30 space-y-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                          Quick Presets
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {FILTER_QUICK_PRESET_OPTIONS.map((preset) => {
                            const active = quickPreset === preset.value;
                            return (
                              <button
                                key={preset.value}
                                type="button"
                                onClick={() => applyQuickPreset(preset.value)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors ${
                                  active
                                    ? 'bg-blue-50 text-blue-600 border-blue-200'
                                    : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                          Match Mode
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {FILTER_MATCH_MODE_OPTIONS.map((mode) => {
                            const active = matchMode === mode.value;
                            return (
                              <button
                                key={mode.value}
                                type="button"
                                onClick={() => handleMatchModeChange(mode.value)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors ${
                                  active
                                    ? 'bg-blue-50 text-blue-600 border-blue-200'
                                    : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                {mode.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                          Status
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {FILTER_STATUS_OPTIONS.map((option) => {
                            const active = statusFilter === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => handleStatusFilterChange(option.value)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors ${
                                  active
                                    ? 'bg-blue-50 text-blue-600 border-blue-200'
                                    : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                          Quality
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {FILTER_QUALITY_OPTIONS.map((option) => {
                            const active = qualityFilters.includes(option.value);
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => toggleQualityFilter(option.value)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors ${
                                  active
                                    ? 'bg-blue-50 text-blue-600 border-blue-200'
                                    : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={clearFilters}
                  disabled={!hasActiveFilter}
                  className="h-8 w-8 shrink-0 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Clear filter"
                  title="Clear filter"
                >
                  <svg
                    className="w-3.5 h-3.5 mx-auto"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {filteredSegments.map((item) => (
              <EditorRow
                key={item.segment.segmentId}
                segment={item.segment}
                rowNumber={item.segment.meta?.rowRef || item.originalIndex + 1}
                isActive={item.segment.segmentId === activeSegmentId}
                onActivate={setActiveSegmentId}
                onChange={handleTranslationChange}
                onConfirm={confirmSegment}
                saveError={segmentSaveErrors[item.segment.segmentId]}
                sourceHighlightQuery={debouncedSourceQuery}
                targetHighlightQuery={debouncedTargetQuery}
                highlightMode={matchMode}
              />
            ))}

            {filteredSegments.length === 0 && (
              <div className="px-8 py-10 text-center text-sm text-gray-400">
                No segments match current filters.
              </div>
            )}

            <div className="h-64 bg-gray-50/30" />
          </div>
        </div>

        {/* Right Sidebar */}
        <div
          className="border-l border-gray-200 bg-gray-50/50 flex-col hidden lg:flex relative"
          style={{ width: `${sidebarWidth}px` }}
        >
          <button
            type="button"
            aria-label="Resize sidebar"
            onMouseDown={(event) => {
              event.preventDefault();
              setIsResizingSidebar(true);
            }}
            className="absolute -left-1 top-0 h-full w-2 cursor-col-resize group z-20"
          >
            <span className="absolute left-1/2 -translate-x-1/2 h-full w-[2px] bg-transparent group-hover:bg-blue-300 transition-colors" />
          </button>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-white">
            <button
              onClick={() => setActiveTab('tm')}
              className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'tm'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              CAT
            </button>
            <button
              onClick={() => setActiveTab('concordance')}
              title="Concordance (Ctrl/Cmd+K)"
              className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'concordance'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Concordance
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'tm' ? (
              <TMPanel
                matches={activeMatches}
                termMatches={activeTerms}
                onApply={handleApplyMatch}
                onApplyTerm={handleApplyTerm}
              />
            ) : (
              <ConcordancePanel
                projectId={projectId || 0}
                focusSignal={concordanceFocusSignal}
                externalQuery={concordanceQuery}
                searchSignal={concordanceSearchSignal}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
