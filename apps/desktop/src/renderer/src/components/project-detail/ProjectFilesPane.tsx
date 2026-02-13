import { ProjectFile, ProjectType } from '@cat/core';
import { ProjectAIController } from '../../hooks/projectDetail/useProjectAI';
import { ProjectAIPane } from './ProjectAIPane';

interface ProjectFilesPaneProps {
  files: ProjectFile[];
  onOpenFile: (fileId: number) => void;
  onOpenCommitModal: (file: ProjectFile) => void;
  onOpenMatchModal: (file: ProjectFile) => void;
  onDeleteFile: (fileId: number, fileName: string) => Promise<void>;
  onExportFile: (fileId: number, fileName: string) => Promise<void>;
  ai: ProjectAIController;
  projectType?: ProjectType;
}

export function ProjectFilesPane({
  files,
  onOpenFile,
  onOpenCommitModal,
  onOpenMatchModal,
  onDeleteFile,
  onExportFile,
  ai,
  projectType = 'translation',
}: ProjectFilesPaneProps) {
  const isReviewProject = projectType === 'review';
  return (
    <div className="max-w-4xl mx-auto">
      <ProjectAIPane ai={ai} projectType={projectType} />

      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6">Files</h3>

      {files.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-gray-500">No files added yet. Click "+ Add File" to start.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {files.map(file => {
            const progress = file.totalSegments === 0 ? 0 : Math.round((file.confirmedSegments / file.totalSegments) * 100);
            const job = ai.getFileJob(file.id);
            const jobRunning = job?.status === 'running';

            return (
              <div
                key={file.id}
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all group"
              >
                <div className="flex-1 cursor-pointer" onClick={() => onOpenFile(file.id)}>
                  <h4 className="font-bold text-gray-800 group-hover:text-blue-600">{file.name}</h4>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium">
                      {progress}% ({file.confirmedSegments}/{file.totalSegments})
                    </span>
                  </div>
                  {job && (
                    <div className="mt-2 w-48">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${job.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'}`}
                          style={{ width: `${job.progress || 0}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        {job.message || (job.status === 'completed' ? 'Completed' : 'In progress')}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onOpenCommitModal(file)}
                    className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-100"
                  >
                    Commit
                  </button>
                  <button
                    onClick={() => onOpenMatchModal(file)}
                    className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100"
                  >
                    TM Match
                  </button>
                  <button
                    onClick={() => void ai.startAITranslateFile(file.id, file.name)}
                    disabled={jobRunning}
                    className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {jobRunning
                      ? isReviewProject
                        ? 'AI Reviewing...'
                        : 'AI Translating...'
                      : isReviewProject
                        ? 'AI Review'
                        : 'AI Translate'}
                  </button>
                  <button
                    onClick={() => onOpenFile(file.id)}
                    className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => void onExportFile(file.id, file.name)}
                    className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50"
                  >
                    Export
                  </button>
                  <button
                    onClick={() => void onDeleteFile(file.id, file.name)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                    title="Delete File"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
