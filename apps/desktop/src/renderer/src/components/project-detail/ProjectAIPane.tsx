import { ProjectType } from '@cat/core';
import { ProjectAIController } from '../../hooks/projectDetail/useProjectAI';

interface ProjectAIPaneProps {
  ai: ProjectAIController;
  projectType?: ProjectType;
}

export function ProjectAIPane({ ai, projectType = 'translation' }: ProjectAIPaneProps) {
  const isReviewProject = projectType === 'review';
  const isCustomProject = projectType === 'custom';
  return (
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
        placeholder={
          isReviewProject
            ? 'Optional. Add project-specific review instructions (accuracy, fluency, style, severity rules).'
            : isCustomProject
              ? 'Required. Define full custom processing instructions for input/context/output.'
              : 'Optional. Add project-specific translation instructions (tone, terminology, style).'
        }
        className="w-full text-sm bg-white border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <p className="mt-2 text-[11px] text-gray-500">
        {isReviewProject
          ? 'This prompt will be appended to the default AI review rules.'
          : isCustomProject
            ? 'This prompt is used as the full custom system prompt.'
            : 'This prompt will be appended to the default translation rules.'}
      </p>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
          {isReviewProject ? 'Test Text' : isCustomProject ? 'Test Input' : 'Test Source'}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={ai.testSource}
            onChange={(event) => ai.setTestSource(event.target.value)}
            placeholder={
              isReviewProject
                ? 'Enter a short sentence to test AI review'
                : isCustomProject
                  ? 'Enter a short sentence to test AI custom processing'
                  : 'Enter a short sentence to test AI translation'
            }
            className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => void ai.testPrompt()}
            className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
          >
            Test Prompt
          </button>
        </div>
        <label className="block mt-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
          Test Context (Optional)
        </label>
        <input
          type="text"
          value={ai.testContext}
          onChange={(event) => ai.setTestContext(event.target.value)}
          placeholder={
            isReviewProject
              ? 'Optional source-language context for review'
              : isCustomProject
                ? 'Optional context for custom processing'
                : 'Optional translation context'
          }
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {ai.testResult && (
          <div className="mt-2">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              {isReviewProject
                ? 'Reviewed Text'
                : isCustomProject
                  ? 'Processed Text'
                  : 'Translated Text'}
            </div>
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
  );
}
