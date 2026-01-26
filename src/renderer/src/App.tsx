import React, { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { Editor } from './components/Editor';
import { useProjects } from './hooks/useProjects';
import { useTM } from './hooks/useTM';

function App(): JSX.Element {
  // View State: 'dashboard' | 'editor'
  const [currentView, setCurrentView] = useState<'dashboard' | 'editor'>('dashboard');
  const [activeFileId, setActiveFileId] = useState<number | null>(null);

  // Hooks
  const { files, loadFiles, addFiles, deleteFile, batchMatch, updateFileProgress } = useProjects();
  const { importTM } = useTM(undefined); // For global TM actions

  const handleSelectFile = (id: number) => {
    setActiveFileId(id);
    setCurrentView('editor');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setActiveFileId(null);
    loadFiles(); // Refresh to ensure consistency
  };

  const handleImportTM = async () => {
    try {
      const count = await importTM();
      if (count > 0) {
        alert(`Successfully imported ${count} entries into TM.`);
      }
    } catch (error) {
      alert('Failed to import TM');
    }
  };

  // Render Editor View
  if (currentView === 'editor' && activeFileId !== null) {
    return (
      <Editor
        activeFileId={activeFileId}
        files={files}
        onBack={handleBackToDashboard}
        onProgressUpdate={updateFileProgress}
      />
    );
  }

  // Render Dashboard View
  return (
    <div
      style={{
        height: '100vh',
        backgroundColor: '#f5f5f5',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <header
        style={{
          padding: '15px 40px',
          backgroundColor: '#fff',
          borderBottom: '1px solid #ddd',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '20px', color: '#1890ff' }}>Simple CAT Tool</h1>
        <button
          onClick={handleImportTM}
          style={{
            padding: '8px 16px',
            backgroundColor: '#fff',
            color: '#666',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Manage TM
        </button>
      </header>
      <Dashboard
        files={files}
        onOpenFile={handleSelectFile}
        onAddFiles={addFiles}
        onDeleteFile={deleteFile}
        onBatchMatch={batchMatch}
      />
    </div>
  );
}

export default App;
