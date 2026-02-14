import type { MountedTM, TMWithStats } from '../../../../shared/ipc';

interface ProjectTMPaneProps {
  mountedTMs: MountedTM[];
  allMainTMs: TMWithStats[];
  onMountTM: (tmId: string) => void;
  onUnmountTM: (tmId: string) => void;
}

export function ProjectTMPane({
  mountedTMs,
  allMainTMs,
  onMountTM,
  onUnmountTM,
}: ProjectTMPaneProps) {
  const workingTMs = mountedTMs.filter((tm) => tm.type === 'working');
  const mountedMainTMs = mountedTMs.filter((tm) => tm.type === 'main');

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
          Working Translation Memory
        </h3>
        <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100">
          {workingTMs.map((tm) => (
            <div key={tm.id} className="flex justify-between items-center">
              <div>
                <h4 className="font-bold text-blue-900">{tm.name}</h4>
                <p className="text-xs text-blue-600 mt-1">
                  Automatic updates on segment confirmation. Read/Write enabled.
                </p>
              </div>
              <div className="text-right">
                <span className="block text-lg font-bold text-blue-900">{tm.entryCount || 0}</span>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tight">
                  Segments
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
            Mounted Main TMs (Read-only)
          </h3>
          <div className="flex items-center gap-2">
            <select
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium outline-none"
              onChange={(event) => {
                if (!event.target.value) return;
                onMountTM(event.target.value);
              }}
              value=""
            >
              <option value="" disabled>
                + Main TM
              </option>
              {allMainTMs
                .filter((tm) => !mountedTMs.find((mounted) => mounted.id === tm.id))
                .map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {tm.name} ({tm.srcLang}→{tm.tgtLang})
                  </option>
                ))}
            </select>
          </div>
        </div>

        {mountedMainTMs.length === 0 ? (
          <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-8 text-center">
            <p className="text-xs text-gray-400">No Main TMs mounted to this project yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {mountedMainTMs.map((tm) => (
              <div
                key={tm.id}
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800">{tm.name}</h4>
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                      {tm.srcLang} → {tm.tgtLang}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="block text-sm font-bold text-gray-700">
                      {tm.entryCount || 0}
                    </span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase">Segments</span>
                  </div>
                  <button
                    onClick={() => onUnmountTM(tm.id)}
                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                    title="Unmount from Project"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
