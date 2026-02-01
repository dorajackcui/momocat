import React, { useState, useEffect } from 'react';
import { Project, ProjectFile } from '@cat/core';
import { ColumnSelector } from './ColumnSelector';

interface ProjectDetailProps {
  projectId: number;
  onBack: () => void;
  onOpenFile: (fileId: number) => void;
}

export function ProjectDetail({ projectId, onBack, onOpenFile }: ProjectDetailProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'files' | 'tm'>('files');

  // TM State
  const [mountedTMs, setMountedTMs] = useState<any[]>([]);
  const [allMainTMs, setAllMainTMs] = useState<any[]>([]);

  // Column Selector State
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [pendingFilePath, setPendingFilePath] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any[][]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const p = await window.api.getProject(projectId);
      const f = await window.api.getProjectFiles(projectId);
      setProject(p);
      setFiles(f);

      // Load TM info
      const mounted = await window.api.getProjectMountedTMs(projectId);
      const allMain = await window.api.listTMs('main');
      setMountedTMs(mounted);
      setAllMainTMs(allMain);
    } catch (error) {
      console.error('Failed to load project details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleMountTM = async (tmId: string) => {
    try {
      await window.api.mountTMToProject(projectId, tmId);
      loadData();
    } catch (e) {
      alert('Failed to mount TM');
    }
  };

  const handleUnmountTM = async (tmId: string) => {
    try {
      await window.api.unmountTMFromProject(projectId, tmId);
      loadData();
    } catch (e) {
      alert('Failed to unmount TM');
    }
  };

  const handleCommitFileToMainTM = async (fileId: number, tmId: string) => {
    try {
      const count = await window.api.commitToMainTM(tmId, fileId);
      alert(`Successfully committed ${count} confirmed segments to Main TM.`);
      loadData();
    } catch (e) {
      alert('Failed to commit segments');
    }
  };

  const handleAddFile = async () => {
    const filePath = await window.api.openFileDialog([
      { name: 'Spreadsheets', extensions: ['xlsx', 'csv'] }
    ]);
    
    if (filePath) {
      try {
        setLoading(true);
        const preview = await window.api.getFilePreview(filePath);
        setPreviewData(preview);
        setPendingFilePath(filePath);
        setIsSelectorOpen(true);
      } catch (error) {
        alert('Failed to read file: ' + (error instanceof Error ? error.message : String(error)));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleConfirmImport = async (options: { hasHeader: boolean; sourceCol: number; targetCol: number; contextCol?: number }) => {
    if (!pendingFilePath) return;

    try {
      setLoading(true);
      setIsSelectorOpen(false);
      await window.api.addFileToProject(projectId, pendingFilePath, {
        hasHeader: options.hasHeader,
        sourceCol: options.sourceCol,
        targetCol: options.targetCol,
        contextCol: options.contextCol
      });
      await loadData();
      setPendingFilePath(null);
    } catch (error) {
      alert('Failed to add file: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFile = async (fileId: number, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return;

    try {
      setLoading(true);
      await window.api.deleteFile(fileId);
      await loadData();
    } catch (error) {
      alert('Failed to delete file');
    } finally {
      setLoading(false);
    }
  };

  const handleExportFile = async (fileId: number, fileName: string) => {
    const defaultPath = fileName.replace(/(\.xlsx|\.csv)$/i, '_translated$1');
    const outputPath = await window.api.saveFileDialog(defaultPath, [
      { name: 'Spreadsheets', extensions: ['xlsx', 'csv'] }
    ]);

    if (outputPath) {
      try {
        await window.api.exportFile(fileId, outputPath);
        alert('Export successful');
      } catch (error) {
        alert('Export failed: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <ColumnSelector 
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        onConfirm={handleConfirmImport}
        previewData={previewData}
      />
      {/* Sub-header / Breadcrumbs */}
      <div className="px-10 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            title="Back to Dashboard"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {loading ? 'Loading...' : (project?.name || 'Project Not Found')}
            </h2>
            {project && (
              <p className="text-xs text-gray-500">{project.srcLang} → {project.tgtLang}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Tab Switcher */}
          <div className="flex bg-gray-200/50 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('files')}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                activeTab === 'files' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Files
            </button>
            <button
              onClick={() => setActiveTab('tm')}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                activeTab === 'tm' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Translation Memory
            </button>
          </div>

          <div className="h-6 w-[1px] bg-gray-200" />

          {project && activeTab === 'files' && (
            <button
              onClick={handleAddFile}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              + Add File
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-10">
        {!project && !loading ? (
          <div className="max-w-4xl mx-auto text-center py-20 bg-red-50 rounded-xl border border-red-100">
            <p className="text-red-600 font-medium">Error: Project with ID {projectId} could not be found.</p>
            <button 
              onClick={onBack}
              className="mt-4 text-blue-600 font-bold hover:underline"
            >
              Go back to Dashboard
            </button>
          </div>
        ) : activeTab === 'files' ? (
          <div className="max-w-4xl mx-auto">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6">Files</h3>
            
            {files.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <p className="text-gray-500">No files added yet. Click "+ Add File" to start.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {files.map(file => {
                  const progress = file.totalSegments === 0 ? 0 : Math.round((file.confirmedSegments / file.totalSegments) * 100);
                  return (
                    <div 
                      key={file.id}
                      className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all group"
                    >
                      <div className="flex-1 cursor-pointer" onClick={() => onOpenFile(file.id)}>
                        <h4 className="font-bold text-gray-800 group-hover:text-blue-600">{file.name}</h4>
                        <div className="flex items-center gap-4 mt-1">
                          <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500" 
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400 font-medium">{progress}% ({file.confirmedSegments}/{file.totalSegments})</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Commit to Main TM Dropdown logic simplified for v0.2 */}
                        {mountedTMs.filter(tm => tm.type === 'main').length > 0 && (
                          <select 
                            className="px-2 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-[10px] font-bold border-none outline-none cursor-pointer"
                            onChange={(e) => {
                              if (e.target.value) handleCommitFileToMainTM(file.id, e.target.value);
                              e.target.value = "";
                            }}
                          >
                            <option value="">Commit</option>
                            {mountedTMs.filter(tm => tm.type === 'main').map(tm => (
                              <option key={tm.id} value={tm.id}>{tm.name}</option>
                            ))}
                          </select>
                        )}
                        <button 
                          onClick={() => onOpenFile(file.id)}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100"
                        >
                          Open
                        </button>
                        <button 
                          onClick={() => handleExportFile(file.id, file.name)}
                          className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50"
                        >
                          Export
                        </button>
                        <button 
                          onClick={() => handleDeleteFile(file.id, file.name)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                          title="Delete File"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Working TM Section */}
            <div>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Working Translation Memory</h3>
              <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100">
                {mountedTMs.filter(tm => tm.type === 'working').map(tm => (
                  <div key={tm.id} className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-blue-900">{tm.name}</h4>
                      <p className="text-xs text-blue-600 mt-1">Automatic updates on segment confirmation. Read/Write enabled.</p>
                    </div>
                    <div className="text-right">
                      <span className="block text-lg font-bold text-blue-900">{tm.entryCount || 0}</span>
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tight">Segments</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mounted Main TMs Section */}
            <div>
              <div className="flex justify-between items-end mb-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Mounted Main TMs (Read-only)</h3>
                <div className="flex items-center gap-2">
                  <select 
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium outline-none"
                    onChange={(e) => handleMountTM(e.target.value)}
                    value=""
                  >
                    <option value="" disabled>+ Main TM</option>
                    {allMainTMs
                      .filter(tm => !mountedTMs.find(m => m.id === tm.id))
                      .map(tm => (
                        <option key={tm.id} value={tm.id}>{tm.name} ({tm.srcLang}→{tm.tgtLang})</option>
                      ))
                    }
                  </select>
                </div>
              </div>

              {mountedTMs.filter(tm => tm.type === 'main').length === 0 ? (
                <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-8 text-center">
                  <p className="text-xs text-gray-400">No Main TMs mounted to this project yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {mountedTMs.filter(tm => tm.type === 'main').map(tm => (
                    <div key={tm.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">{tm.name}</h4>
                          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{tm.srcLang} → {tm.tgtLang}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <span className="block text-sm font-bold text-gray-700">{tm.entryCount || 0}</span>
                          <span className="text-[9px] font-bold text-gray-400 uppercase">Segments</span>
                        </div>
                        <button 
                          onClick={() => handleUnmountTM(tm.id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                          title="Unmount from Project"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
