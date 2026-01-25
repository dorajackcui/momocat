import React, { useState, useEffect } from 'react';
import { Segment } from './types';
import { EditorRow } from './components/EditorRow';
import { ProgressBar } from './components/ProgressBar';
import { TMPanel, TMMatch } from './components/TMPanel';
import { ColumnSelector } from './components/ColumnSelector';
import * as XLSX from 'xlsx';

function App(): JSX.Element {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);

  // New state for Column Selection
  const [rawGridData, setRawGridData] = useState<any[][]>([]);
  const [showColSelector, setShowColSelector] = useState(false);
  const [colMapping, setColMapping] = useState({ source: 0, target: 1 });

  // TM State
  const [tmMatches, setTmMatches] = useState<TMMatch[]>([]);
  const [isTmLoading, setIsTmLoading] = useState(false);

  // Trigger fuzzy search when active segment changes
  useEffect(() => {
    const fetchMatches = async () => {
      if (activeSegmentId === null) return;

      const currentSegment = segments.find((s) => s.id === activeSegmentId);
      if (!currentSegment || !currentSegment.source) {
        setTmMatches([]);
        return;
      }

      setIsTmLoading(true);
      try {
        if (window.api) {
          const results = await window.api.fuzzySearchTM(currentSegment.source);
          setTmMatches(results);
        }
      } catch (error) {
        console.error('TM search failed:', error);
      } finally {
        setIsTmLoading(false);
      }
    };

    // Debounce slightly to avoid too many IPC calls if scrolling fast
    const timer = setTimeout(fetchMatches, 300);
    return () => clearTimeout(timer);
  }, [activeSegmentId, segments]); // segments dependency needed if source changes? usually source doesn't change

  const handleOpenFile = async () => {
    try {
      if (window.api) {
        const result = await window.api.openFile();
        if (result) {
          setFilePath(result.path);

          // Store raw data and open column selector
          setRawGridData(result.content);
          setShowColSelector(true);
        }
      }
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  };

  const handleColumnConfirm = async (sourceIndex: number, targetIndex: number) => {
    setShowColSelector(false);
    setColMapping({ source: sourceIndex, target: targetIndex });

    // Process segments based on selected columns
    // Assuming row 0 is header, so we start from row 1
    const dataRows = rawGridData.slice(1);

    // NO FILTERING: Keep all rows to ensure 1:1 mapping with Excel for high-fidelity export
    // const validRows = dataRows.filter(row => row[sourceIndex])
    const validRows = dataRows;
    const sources = validRows.map((row) => (row[sourceIndex] ? String(row[sourceIndex]) : ''));

    // 2. Query TM for matches in chunks to avoid blocking UI
    const tmMatches: Record<string, string> = {};
    const CHUNK_SIZE = 1000;

    // Initial render without matches first (for immediate feedback)
    const processedSegments = validRows.map((row, index) => ({
      id: index,
      source: row[sourceIndex] ? String(row[sourceIndex]) : '', // Empty string if undefined
      target: row[targetIndex] ? String(row[targetIndex]) : '',
      isTmMatch: false,
    }));
    setSegments(processedSegments);

    // Activate first non-empty segment
    const firstNonEmpty = processedSegments.findIndex((s) => s.source);
    if (firstNonEmpty !== -1) setActiveSegmentId(firstNonEmpty);

    // Process TM matching in background chunks
    try {
      // Filter out empty sources for TM query to save resources
      const nonEmptySources = sources.filter((s) => s);

      for (let i = 0; i < nonEmptySources.length; i += CHUNK_SIZE) {
        const chunk = nonEmptySources.slice(i, i + CHUNK_SIZE);
        if (chunk.length === 0) continue;

        const chunkMatches = await window.api.queryTMBatch(chunk);

        // If we found matches, update the state incrementally
        if (Object.keys(chunkMatches).length > 0) {
          // Merge new matches
          Object.assign(tmMatches, chunkMatches);

          // Update only affected segments in this chunk range
          setSegments((prev) =>
            prev.map((seg, idx) => {
              if (!seg.target && seg.source && chunkMatches[seg.source]) {
                return { ...seg, target: chunkMatches[seg.source], isTmMatch: true };
              }
              return seg;
            }),
          );

          // Yield to main thread to allow UI updates
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    } catch (tmError) {
      console.error('Failed to query TM:', tmError);
    }
  };

  const handleTranslationChange = (id: number, value: string) => {
    setSegments((prev) => prev.map((seg) => (seg.id === id ? { ...seg, target: value } : seg)));
  };

  const handleActivate = (id: number) => {
    setActiveSegmentId(id);
  };

  const handleNext = async () => {
    // 1. Save current segment to TM
    if (activeSegmentId !== null) {
      const currentSegment = segments.find((s) => s.id === activeSegmentId);
      if (currentSegment && currentSegment.source && currentSegment.target) {
        try {
          if (window.api) {
            await window.api.updateTM(currentSegment.source, currentSegment.target);
            // console.log('TM updated for:', currentSegment.source)
          }
        } catch (error) {
          console.error('Failed to update TM:', error);
        }
      }
    }

    // 2. Move to next
    if (activeSegmentId !== null && activeSegmentId < segments.length - 1) {
      setActiveSegmentId(activeSegmentId + 1);
    }
  };

  const handlePrev = () => {
    if (activeSegmentId !== null && activeSegmentId > 0) {
      setActiveSegmentId(activeSegmentId - 1);
    }
  };

  const handleSaveFile = async () => {
    if (filePath) {
      // Prepare data for export
      // We need to pass the updated segments and the target column index
      const data = segments.map((s) => [s.source, s.target]);
      const defaultPath = filePath.replace(/(\.xlsx|\.xls)$/i, '_translated.xlsx');

      try {
        if (!window.api) {
          throw new Error('API is not available');
        }

        // Pass originalFilePath and targetColIndex to the backend
        // We use @ts-ignore because we haven't updated the type definition yet,
        // but the backend handler will be updated to accept these arguments.
        // Arguments: defaultPath, content, originalFilePath, targetColIndex
        // @ts-ignore
        const result = await window.api.saveFile(defaultPath, data, filePath, colMapping.target);

        if (result) {
          alert('File saved to ' + result);
        }
      } catch (error) {
        console.error('Native save failed, trying browser download:', error);

        // Fallback: Browser-side download
        try {
          const newGrid = [...rawGridData];

          // Map segments back to the grid based on the selected target column
          // We iterate through the grid and update rows that were identified as valid segments
          let segIdx = 0;
          for (let i = 1; i < newGrid.length; i++) {
            // We are now 1:1 mapped (since we removed filtering), so we can just use index
            if (segIdx < segments.length) {
              newGrid[i][colMapping.target] = segments[segIdx].target;
              segIdx++;
            }
          }

          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.aoa_to_sheet(newGrid);
          XLSX.utils.book_append_sheet(wb, ws, 'Translation');

          const filename = defaultPath.split(/[/\\]/).pop() || 'translated.xlsx';
          XLSX.writeFile(wb, filename);

          const msg = (error as any).message || String(error);
          if (msg.includes('EPERM') || msg.includes('access')) {
            alert(
              'Note: System permission denied (Sandbox). File has been downloaded via browser instead. (Styles may not be preserved in fallback mode)',
            );
          }
        } catch (fallbackError) {
          console.error('Fallback save failed:', fallbackError);
          alert('Failed to save file: ' + (error as Error).message);
        }
      }
    }
  };

  const handleImportTM = async () => {
    try {
      if (!window.api) return;
      const count = await window.api.importTM();
      if (count > 0) {
        alert(`Successfully imported ${count} entries into TM.`);
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('Failed to import TM');
    }
  };

  const handleApplyTM = (target: string) => {
    if (activeSegmentId !== null) {
      handleTranslationChange(activeSegmentId, target);
      // Optional: Auto focus back to editor? EditorRow should handle focus
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {showColSelector && (
        <ColumnSelector
          headers={rawGridData[0] || []}
          previewData={rawGridData.slice(1, 6)} // Preview first 5 rows
          onConfirm={handleColumnConfirm}
          onCancel={() => {
            setShowColSelector(false);
            setFilePath(null); // Reset if canceled
          }}
        />
      )}

      <header
        style={{
          padding: '10px 20px',
          borderBottom: '1px solid #ddd',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#fff',
          zIndex: 10,
        }}
      >
        <h1 style={{ margin: 0, fontSize: '20px' }}>Simple CAT Tool</h1>
        <div>
          <button
            onClick={handleImportTM}
            style={{
              padding: '6px 12px',
              marginRight: '10px',
              backgroundColor: '#faad14',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Import TM
          </button>
          <button
            onClick={handleOpenFile}
            style={{
              padding: '6px 12px',
              marginRight: '10px',
              backgroundColor: '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Open Excel
          </button>
          {filePath && (
            <button
              onClick={handleSaveFile}
              style={{
                padding: '6px 12px',
                backgroundColor: '#52c41a',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Export
            </button>
          )}
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Main Editor Area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
            overflowY: 'auto',
            minHeight: 0,
          }}
        >
          {filePath && (
            <div style={{ marginBottom: '15px', color: '#666', fontSize: '12px' }}>
              File: {filePath}
            </div>
          )}

          {segments.length > 0 && <ProgressBar segments={segments} />}

          {segments.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                // overflow: 'hidden' removed to allow scrolling
              }}
            >
              <div
                style={{
                  fontWeight: 'bold',
                  backgroundColor: '#fafafa',
                  padding: '10px',
                  borderBottom: '1px solid #d9d9d9',
                }}
              >
                Source Text
              </div>
              <div
                style={{
                  fontWeight: 'bold',
                  backgroundColor: '#fafafa',
                  padding: '10px',
                  borderBottom: '1px solid #d9d9d9',
                }}
              >
                Target Text
              </div>

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
            <div
              style={{ marginTop: '20px', color: '#999', fontSize: '12px', textAlign: 'center' }}
            >
              Tips: Use <b>Cmd/Ctrl + Enter</b> to confirm and jump to next segment.
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div style={{ width: '300px', flexShrink: 0 }}>
          <TMPanel matches={tmMatches} loading={isTmLoading} onApply={handleApplyTM} />
        </div>
      </div>
    </div>
  );
}

export default App;
