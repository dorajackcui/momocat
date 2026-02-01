import React from 'react';
import { ProjectFile } from '../types';

interface DashboardProps {
  projects: ProjectFile[];
  loading?: boolean;
  onOpenProject: (id: number) => void;
  onCreateProject: () => void;
  onExportProject: (id: number, name: string) => void;
}

export function Dashboard({
  projects,
  loading,
  onOpenProject,
  onCreateProject,
  onExportProject,
}: DashboardProps) {
  return (
    <div className="p-10 max-w-[1000px] mx-auto h-full overflow-y-auto relative">
      {loading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl border border-gray-100 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-sm font-medium text-gray-600">Processing...</p>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Projects</h1>
        <button
          onClick={onCreateProject}
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
                  <div className="text-xs text-gray-500 mt-1 flex items-center">
                    <span className="bg-gray-100 px-2 py-0.5 rounded mr-2">
                      {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'N/A'}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {project.srcLang} → {project.tgtLang}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex justify-between text-xs font-medium mb-2 text-gray-600">
                  <span>Translation Progress</span>
                  <span>{project.progress}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              <div className="mt-auto flex gap-3">
                <button
                  onClick={() => onOpenProject(project.id)}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
                >
                  Open
                </button>
                <button
                  onClick={() => onExportProject(project.id, project.name)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm"
                >
                  Export
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
