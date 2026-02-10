import React, { useState } from 'react';
import { ProjectFile } from '@cat/core';
import { ColumnSelector } from './ColumnSelector';
import { apiClient } from '../services/apiClient';
import { useProjectDetailData } from '../hooks/projectDetail/useProjectDetailData';
import { useProjectFileImport } from '../hooks/projectDetail/useProjectFileImport';
import { useProjectAI } from '../hooks/projectDetail/useProjectAI';
import { ProjectCommitModal } from './project-detail/ProjectCommitModal';
import { ProjectMatchModal } from './project-detail/ProjectMatchModal';
import { ProjectFilesPane } from './project-detail/ProjectFilesPane';
import { ProjectTMPane } from './project-detail/ProjectTMPane';
import { ProjectTBPane } from './project-detail/ProjectTBPane';

interface ProjectDetailProps {
  projectId: number;
  onBack: () => void;
  onOpenFile: (fileId: number) => void;
}

export function ProjectDetail({ projectId, onBack, onOpenFile }: ProjectDetailProps) {
  const [activeTab, setActiveTab] = useState<'files' | 'tm' | 'tb'>('files');
  const [commitModalFile, setCommitModalFile] = useState<ProjectFile | null>(null);
  const [commitTmId, setCommitTmId] = useState('');
  const [matchModalFile, setMatchModalFile] = useState<ProjectFile | null>(null);
  const [matchTmId, setMatchTmId] = useState('');

  const {
    project,
    setProject,
    files,
    mountedTMs,
    allMainTMs,
    mountedTBs,
    allTBs,
    loading,
    loadData,
    runMutation,
    mountTM,
    unmountTM,
    mountTB,
    unmountTB,
    commitToMainTM,
    matchFileWithTM
  } = useProjectDetailData(projectId);

  const fileImport = useProjectFileImport({
    projectId,
    loadData,
    runMutation
  });

  const ai = useProjectAI({
    project,
    setProject,
    loadData,
    runMutation
  });

  const openCommitModal = (file: ProjectFile) => {
    const mountedMainTMs = mountedTMs.filter(tm => tm.type === 'main');
    if (mountedMainTMs.length === 0) {
      alert('No mounted Main TM found. Please mount a Main TM first.');
      return;
    }
    setCommitModalFile(file);
    setCommitTmId(mountedMainTMs[0].id);
  };

  const confirmCommitModal = async () => {
    if (!commitModalFile || !commitTmId) return;
    try {
      const count = await commitToMainTM(commitTmId, commitModalFile.id);
      alert(`Successfully committed ${count} confirmed segments to Main TM.`);
    } catch {
      alert('Failed to commit segments');
    } finally {
      setCommitModalFile(null);
      setCommitTmId('');
    }
  };

  const openMatchModal = (file: ProjectFile) => {
    if (mountedTMs.length === 0) {
      alert('No mounted TM found. Please mount a TM first.');
      return;
    }
    setMatchModalFile(file);
    setMatchTmId(mountedTMs[0].id);
  };

  const confirmMatchModal = async () => {
    if (!matchModalFile || !matchTmId) return;
    try {
      const result = await matchFileWithTM(matchModalFile.id, matchTmId);
      alert(
        `TM batch matching completed.\nTotal: ${result.total}\nMatched: ${result.matched}\nApplied: ${result.applied}\nSkipped: ${result.skipped}`
      );
    } catch {
      alert('TM matching failed.');
    } finally {
      setMatchModalFile(null);
      setMatchTmId('');
    }
  };

  const handleMountTM = async (tmId: string) => {
    try {
      await mountTM(tmId);
    } catch {
      alert('Failed to mount TM');
    }
  };

  const handleUnmountTM = async (tmId: string) => {
    try {
      await unmountTM(tmId);
    } catch {
      alert('Failed to unmount TM');
    }
  };

  const handleMountTB = async (tbId: string) => {
    try {
      await mountTB(tbId);
    } catch {
      alert('Failed to mount term base');
    }
  };

  const handleUnmountTB = async (tbId: string) => {
    try {
      await unmountTB(tbId);
    } catch {
      alert('Failed to unmount term base');
    }
  };

  const handleDeleteFile = async (fileId: number, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return;

    try {
      await runMutation(async () => {
        await apiClient.deleteFile(fileId);
        await loadData();
      });
    } catch {
      alert('Failed to delete file');
    }
  };

  const handleExportFile = async (fileId: number, fileName: string) => {
    const defaultPath = fileName.replace(/(\.xlsx|\.csv)$/i, '_translated$1');
    const outputPath = await apiClient.saveFileDialog(defaultPath, [
      { name: 'Spreadsheets', extensions: ['xlsx', 'csv'] }
    ]);
    if (!outputPath) return;

    try {
      await runMutation(async () => {
        await apiClient.exportFile(fileId, outputPath);
      });
      alert('Export successful');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('Export blocked by QA errors')) {
        alert(`Export failed: ${errorMessage}`);
        return;
      }

      const forceExport = confirm(
        `${errorMessage}\n\nDo you want to force export despite these errors?`
      );

      if (!forceExport) return;

      try {
        await runMutation(async () => {
          await apiClient.exportFile(fileId, outputPath, undefined, true);
        });
        alert('Export successful (forced despite QA errors)');
      } catch (forceError) {
        alert(`Export failed: ${forceError instanceof Error ? forceError.message : String(forceError)}`);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <ColumnSelector
        isOpen={fileImport.isSelectorOpen}
        onClose={fileImport.closeSelector}
        onConfirm={fileImport.confirmImport}
        previewData={fileImport.previewData}
      />

      <ProjectCommitModal
        file={commitModalFile}
        mountedTMs={mountedTMs}
        selectedTmId={commitTmId}
        onSelectedTmIdChange={setCommitTmId}
        onCancel={() => {
          setCommitModalFile(null);
          setCommitTmId('');
        }}
        onConfirm={() => void confirmCommitModal()}
      />

      <ProjectMatchModal
        file={matchModalFile}
        mountedTMs={mountedTMs}
        selectedTmId={matchTmId}
        onSelectedTmIdChange={setMatchTmId}
        onCancel={() => {
          setMatchModalFile(null);
          setMatchTmId('');
        }}
        onConfirm={() => void confirmMatchModal()}
      />

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
            <h2 className="text-xl font-bold text-gray-900">{loading ? 'Loading...' : project?.name || 'Project Not Found'}</h2>
            {project && <p className="text-xs text-gray-500">{project.srcLang} → {project.tgtLang}</p>}
          </div>
        </div>

        <div className="flex items-center gap-4">
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
            <button
              onClick={() => setActiveTab('tb')}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                activeTab === 'tb' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Term Bases
            </button>
          </div>

          <div className="h-6 w-[1px] bg-gray-200" />

          {project && activeTab === 'files' && (
            <button
              onClick={() => void fileImport.openFileImport()}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              + Add File
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-10">
        {!project ? (
          loading ? (
            <div className="max-w-4xl mx-auto text-center py-20 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-gray-500">Loading project details...</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto text-center py-20 bg-red-50 rounded-xl border border-red-100">
              <p className="text-red-600 font-medium">Error: Project with ID {projectId} could not be found.</p>
              <button onClick={onBack} className="mt-4 text-blue-600 font-bold hover:underline">
                Go back to Dashboard
              </button>
            </div>
          )
        ) : activeTab === 'files' ? (
          <ProjectFilesPane
            files={files}
            onOpenFile={onOpenFile}
            onOpenCommitModal={openCommitModal}
            onOpenMatchModal={openMatchModal}
            onDeleteFile={handleDeleteFile}
            onExportFile={handleExportFile}
            ai={ai}
          />
        ) : activeTab === 'tm' ? (
          <ProjectTMPane
            mountedTMs={mountedTMs}
            allMainTMs={allMainTMs}
            onMountTM={(tmId) => void handleMountTM(tmId)}
            onUnmountTM={(tmId) => void handleUnmountTM(tmId)}
          />
        ) : (
          <ProjectTBPane
            mountedTBs={mountedTBs}
            allTBs={allTBs}
            onMountTB={(tbId) => void handleMountTB(tbId)}
            onUnmountTB={(tbId) => void handleUnmountTB(tbId)}
          />
        )}
      </div>
    </div>
  );
}
