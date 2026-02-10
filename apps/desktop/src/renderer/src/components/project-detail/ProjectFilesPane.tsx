import { Project, ProjectFile } from '@cat/core';
import { ProjectAIController } from '../../hooks/projectDetail/useProjectAI';

interface ProjectFilesPaneProps {
  project: Project;
  files: ProjectFile[];
  onOpenFile: (fileId: number) => void;
  onOpenCommitModal: (file: ProjectFile) => void;
  onOpenMatchModal: (file: ProjectFile) => void;
  onDeleteFile: (fileId: number, fileName: string) => Promise<void>;
  onExportFile: (fileId: number, fileName: string) => Promise<void>;
  ai: ProjectAIController;
}

export function ProjectFilesPane({
  project,
  files,
  onOpenFile,
  onOpenCommitModal,
  onOpenMatchModal,
  onDeleteFile,
  onExportFile,
  ai
}: ProjectFilesPaneProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 bg-gray-50 border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">AI Settings</h3>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  ai.hasUnsavedPromptChanges ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {ai.hasUnsavedPromptChanges ? 'Unsaved Changes' : 'Saved'}
              </span>
              {ai.promptSavedAt && !ai.hasUnsavedPromptChanges && (
                <span className="text-[10px] text-gray-400">at {ai.promptSavedAt}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => void ai.savePrompt()}
            disabled={ai.savingPrompt || !ai.hasUnsavedPromptChanges || ai.hasInvalidTemperature}
            className={`px-3 py-1.5 text-white rounded-lg text-xs font-bold disabled:opacity-50 ${
              ai.hasUnsavedPromptChanges ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600'
            }`}
          >
            {ai.savingPrompt ? 'Saving...' : ai.hasUnsavedPromptChanges ? 'Save AI Settings' : 'AI Settings Saved'}
          </button>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Temperature</label>
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={ai.temperatureDraft}
            onChange={(event) => ai.setTemperatureDraft(event.target.value)}
            placeholder="0.2"
            className={`w-40 text-sm bg-white border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${
              ai.hasInvalidTemperature ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'
            }`}
          />
          <p className="mt-1 text-[11px] text-gray-500">Range `0` to `2`. Lower is more deterministic. Default is `0.2`.</p>
          {ai.hasInvalidTemperature && (
            <p className="mt-1 text-[11px] text-red-500">Please enter a valid number from `0` to `2`.</p>
          )}
        </div>
        <textarea
          value={ai.promptDraft}
          onChange={(event) => ai.setPromptDraft(event.target.value)}
          rows={4}
          placeholder="Optional. Add project-specific translation instructions (tone, terminology, style)."
          className="w-full text-sm bg-white border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-2 text-[11px] text-gray-500">This prompt will be appended to the default translation rules.</p>
        <div className="mt-4 pt-4 border-t border-gray-200">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Test Source</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={ai.testSource}
              onChange={(event) => ai.setTestSource(event.target.value)}
              placeholder="Enter a short sentence to test AI translation"
              className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => void ai.testPrompt()}
              className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
            >
              Test Prompt
            </button>
          </div>
          {ai.testResult && (
            <div className="mt-2">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Translated Text</div>
              <div className="text-xs text-gray-600 bg-white border border-gray-200 rounded-lg px-3 py-2">{ai.testResult}</div>
            </div>
          )}
          {ai.testError && (
            <div className="mt-2">
              <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Error</div>
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{ai.testError}</div>
            </div>
          )}
          {ai.hasTestDetails && (
            <div className="mt-2">
              <button
                onClick={() => ai.setShowTestDetails(prev => !prev)}
                className="text-[10px] text-blue-600 font-bold hover:underline"
              >
                {ai.showTestDetails ? 'Hide Test Details' : 'Show Test Details'}
              </button>
            </div>
          )}
          {ai.hasTestDetails && ai.showTestDetails && (
            <>
              {ai.testMeta && (
                <div className="mt-2">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Transport</div>
                  <div className="text-[10px] text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2">{ai.testMeta}</div>
                </div>
              )}
              {ai.testUserMessage && (
                <div className="mt-2">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">User Message</div>
                  <div className="text-[10px] text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2 whitespace-pre-wrap">
                    {ai.testUserMessage}
                  </div>
                </div>
              )}
              {ai.testPromptUsed && (
                <div className="mt-2">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">System Prompt</div>
                  <div className="text-[10px] text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2 whitespace-pre-wrap">
                    {ai.testPromptUsed}
                  </div>
                </div>
              )}
              {ai.testRawResponse && (
                <div className="mt-2">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Raw OpenAI Response</div>
                  <div className="text-[10px] text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2 whitespace-pre-wrap max-h-40 overflow-auto">
                    {ai.testRawResponse}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

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
                    {jobRunning ? 'AI Translating...' : 'AI Translate'}
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
