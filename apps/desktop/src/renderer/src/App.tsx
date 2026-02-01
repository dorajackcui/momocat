import React, { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { ProjectDetail } from './components/ProjectDetail';
import { Editor } from './components/Editor';
import { TMManager } from './components/TMManager';
import { useProjects } from './hooks/useProjects';

type View = 'dashboard' | 'projectDetail' | 'editor' | 'tms';

function App(): JSX.Element {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [activeFileId, setActiveFileId] = useState<number | null>(null);

  const { projects, loading, loadProjects, createProject, deleteProject } = useProjects();

  const handleOpenProject = (id: number) => {
    setActiveProjectId(id);
    setCurrentView('projectDetail');
  };

  const handleOpenFile = (id: number) => {
    setActiveFileId(id);
    setCurrentView('editor');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setActiveProjectId(null);
    setActiveFileId(null);
    loadProjects();
  };

  const handleBackToProject = () => {
    setCurrentView('projectDetail');
    setActiveFileId(null);
  };

  const handleCreateProject = async (name: string, srcLang: string, tgtLang: string) => {
    const newProject = await createProject(name, srcLang, tgtLang);
    if (newProject && newProject.id) {
      handleOpenProject(newProject.id);
    }
  };

  if (currentView === 'editor' && activeFileId !== null) {
    return (
      <Editor
        fileId={activeFileId}
        onBack={handleBackToProject}
      />
    );
  }

  if (currentView === 'projectDetail' && activeProjectId !== null) {
    return (
      <ProjectDetail
        projectId={activeProjectId}
        onBack={handleBackToDashboard}
        onOpenFile={handleOpenFile}
      />
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col font-sans">
      <header className="px-10 py-5 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm">
        <div 
          className="flex items-center gap-3 cursor-pointer" 
          onClick={handleBackToDashboard}
        >
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">C</div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">MomoCAT<span className="text-xs font-normal text-blue-500 ml-1">v0.2</span></h1>
        </div>
        <nav className="flex gap-1">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
              currentView === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setCurrentView('tms')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
              currentView === 'tms' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            TM Manager
          </button>
        </nav>
      </header>
      
      <main className="flex-1 overflow-hidden flex">
        {currentView === 'dashboard' ? (
          <Dashboard
            projects={projects}
            loading={loading}
            onOpenProject={handleOpenProject}
            onCreateProject={handleCreateProject}
            onDeleteProject={deleteProject}
          />
        ) : (
          <TMManager />
        )}
      </main>

      <footer className="px-10 py-3 bg-white border-t border-gray-200 text-[10px] text-gray-400 flex justify-between">
        <span>Ready</span>
        <span>Offline Mode • Spreadsheet-first v0.1</span>
      </footer>
    </div>
  );
}

export default App;
