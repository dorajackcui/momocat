import React, { useState } from 'react';
import { ProjectType } from '@cat/core';
import { CreateProjectModal } from './CreateProjectModal';
import { ProjectWithStats } from '../hooks/useProjects';

interface DashboardProps {
  projects: ProjectWithStats[];
  loading?: boolean;
  onOpenProject: (id: number) => void;
  onCreateProject: (name: string, srcLang: string, tgtLang: string, projectType: ProjectType) => void;
  onDeleteProject: (id: number) => void;
}

export function Dashboard({
  projects,
  loading,
  onOpenProject,
  onCreateProject,
  onDeleteProject,
}: DashboardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleConfirmCreate = async (
    name: string,
    srcLang: string,
    tgtLang: string,
    projectType: ProjectType,
  ) => {
    await onCreateProject(name, srcLang, tgtLang, projectType);
    setIsModalOpen(false);
  };

  return (
    <div className="p-10 max-w-[1000px] mx-auto h-full overflow-y-auto relative">
      <CreateProjectModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmCreate}
        loading={!!loading}
      />
      
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Projects</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          + Create Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center p-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-gray-500">
          <div className="text-6xl mb-6">📁</div>
          <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
          <p>Create a project to start translating your documents.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col hover:shadow-md transition-all duration-200 border-t-4 border-t-blue-500"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3
                    className="text-lg font-bold text-gray-900 truncate"
                    title={project.name}
                  >
                    {project.name}
                  </h3>
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                    <span className="bg-gray-100 px-2 py-0.5 rounded">
                      {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'N/A'}
                    </span>
                    <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold">
                      {project.fileCount || 0} Files
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        project.projectType === 'review'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {project.projectType === 'review' ? 'Review' : 'Translation'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteProject(project.id);
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all ml-2"
                  title="Delete Project"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <div className="mb-6">
                <div className="flex justify-between text-[10px] font-bold mb-2 text-gray-400 uppercase tracking-tight">
                  <span>Total Progress</span>
                  <span>{project.progress}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              <div className="mt-auto">
                <button
                  onClick={() => onOpenProject(project.id)}
                  className="w-full py-2.5 bg-gray-900 text-white rounded-lg font-bold hover:bg-gray-800 transition-colors text-sm"
                >
                  Open
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
