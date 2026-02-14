import { DEFAULT_PROJECT_QA_SETTINGS, ProjectQASettings, SEGMENT_QA_RULE_OPTIONS } from '@cat/core';

interface ProjectQASettingsModalProps {
  isOpen: boolean;
  draft: ProjectQASettings;
  onChange: (next: ProjectQASettings) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}

export function ProjectQASettingsModal({
  isOpen,
  draft,
  onChange,
  onClose,
  onSave,
  saving,
}: ProjectQASettingsModalProps) {
  if (!isOpen) return null;

  const current = draft || DEFAULT_PROJECT_QA_SETTINGS;

  const toggleRule = (ruleId: (typeof SEGMENT_QA_RULE_OPTIONS)[number]['id']) => {
    const enabled = current.enabledRuleIds.includes(ruleId);
    const enabledRuleIds = enabled
      ? current.enabledRuleIds.filter((id) => id !== ruleId)
      : [...current.enabledRuleIds, ruleId];
    onChange({
      ...current,
      enabledRuleIds,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white border border-gray-200 shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">QA Settings</h3>
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
          >
            Close
          </button>
        </div>

        <div className="space-y-3 mb-4">
          {SEGMENT_QA_RULE_OPTIONS.map((rule) => {
            const checked = current.enabledRuleIds.includes(rule.id);
            return (
              <label
                key={rule.id}
                className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleRule(rule.id)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-800">{rule.label}</span>
                  <span className="block text-xs text-gray-500">{rule.description}</span>
                </span>
              </label>
            );
          })}
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50">
          <input
            type="checkbox"
            checked={current.instantQaOnConfirm}
            onChange={(e) =>
              onChange({
                ...current,
                instantQaOnConfirm: e.target.checked,
              })
            }
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-semibold text-gray-800">Instant QA on Confirm</span>
            <span className="block text-xs text-gray-500">
              Run selected QA rules when confirming a segment in the editor.
            </span>
          </span>
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
