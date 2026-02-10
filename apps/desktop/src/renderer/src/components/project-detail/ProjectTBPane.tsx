import type { MountedTB, TBWithStats } from '../../../../shared/ipc';

interface ProjectTBPaneProps {
  mountedTBs: MountedTB[];
  allTBs: TBWithStats[];
  onMountTB: (tbId: string) => void;
  onUnmountTB: (tbId: string) => void;
}

export function ProjectTBPane({ mountedTBs, allTBs, onMountTB, onUnmountTB }: ProjectTBPaneProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Mounted Term Bases</h3>
          <div className="flex items-center gap-2">
            <select
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium outline-none"
              onChange={(event) => {
                if (!event.target.value) return;
                onMountTB(event.target.value);
              }}
              value=""
            >
              <option value="" disabled>
                + Term Base
              </option>
              {allTBs
                .filter(tb => !mountedTBs.find(mounted => mounted.id === tb.id))
                .map(tb => (
                  <option key={tb.id} value={tb.id}>
                    {tb.name} ({tb.srcLang}→{tb.tgtLang})
                  </option>
                ))}
            </select>
          </div>
        </div>

        {mountedTBs.length === 0 ? (
          <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-8 text-center">
            <p className="text-xs text-gray-400">No term base mounted to this project yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {mountedTBs.map(tb => (
              <div key={tb.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21H5a2 2 0 01-2-2V7a2 2 0 012-2h5l2-2h7a2 2 0 012 2v14a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800">{tb.name}</h4>
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                      {tb.srcLang} → {tb.tgtLang}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="block text-sm font-bold text-gray-700">{tb.stats?.entryCount || 0}</span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase">Terms</span>
                  </div>
                  <button
                    onClick={() => onUnmountTB(tb.id)}
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
  );
}
