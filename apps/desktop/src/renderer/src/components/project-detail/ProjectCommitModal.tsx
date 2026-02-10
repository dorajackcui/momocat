import { ProjectFile } from '@cat/core';
import type { MountedTM } from '../../../../shared/ipc';

interface ProjectCommitModalProps {
  file: ProjectFile | null;
  mountedTMs: MountedTM[];
  selectedTmId: string;
  onSelectedTmIdChange: (tmId: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ProjectCommitModal({
  file,
  mountedTMs,
  selectedTmId,
  onSelectedTmIdChange,
  onCancel,
  onConfirm
}: ProjectCommitModalProps) {
  if (!file) return null;

  const mountedMainTMs = mountedTMs.filter(tm => tm.type === 'main');

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 shadow-2xl p-6">
        <h3 className="text-base font-bold text-gray-900">Commit File To Main TM</h3>
        <p className="mt-1 text-xs text-gray-500">
          Select a Main TM for file: <span className="font-semibold">{file.name}</span>
        </p>
        <div className="mt-4">
          <select
            value={selectedTmId}
            onChange={(event) => onSelectedTmIdChange(event.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none"
          >
            {mountedMainTMs.map(tm => (
              <option key={tm.id} value={tm.id}>
                {tm.name} ({tm.srcLang}→{tm.tgtLang})
              </option>
            ))}
          </select>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!selectedTmId}
            className="px-4 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50"
          >
            Commit
          </button>
        </div>
      </div>
    </div>
  );
}
