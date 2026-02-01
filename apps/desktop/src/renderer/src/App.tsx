import React, { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { Editor } from './components/Editor';
import { useProjects } from './hooks/useProjects';

function App(): JSX.Element {
  const [currentView, setCurrentView] = useState<'dashboard' | 'editor'>('dashboard');
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);

  const { projects, loading, loadProjects, createProject, exportProject } = useProjects();

  const handleOpenProject = (id: number) => {
    setActiveProjectId(id);
    setCurrentView('editor');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setActiveProjectId(null);
    loadProjects();
  };

  const handleCreateProject = async () => {
    const newProject = await createProject();
    if (newProject && newProject.id) {
      handleOpenProject(newProject.id);
    }
  };

  if (currentView === 'editor' && activeProjectId !== null) {
    return (
      <Editor
        activeProjectId={activeProjectId}
        projects={projects}
        onBack={handleBackToDashboard}
      />
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col font-sans">
      <header className="px-10 py-5 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">C</div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Simple CAT Tool <span className="text-xs font-normal text-blue-500 ml-1">v0.1</span></h1>
        </div>
        <div className="flex gap-4">
           {/* Global Actions: TM, Settings */}
        </div>
      </header>
      
      <main className="flex-1 overflow-hidden">
        <Dashboard
          projects={projects}
          loading={loading}
          onOpenProject={handleOpenProject}
          onCreateProject={handleCreateProject}
          onExportProject={exportProject}
        />
      </main>

      <footer className="px-10 py-3 bg-white border-t border-gray-200 text-[10px] text-gray-400 flex justify-between">
        <span>Ready</span>
        <span>Offline Mode • Spreadsheet-first v0.1</span>
      </footer>
    </div>
  );
}

export default App;
