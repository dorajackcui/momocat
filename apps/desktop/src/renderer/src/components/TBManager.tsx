import React, { useEffect, useState } from 'react';
import { TBImportWizard } from './TBImportWizard';

interface TermBase {
  id: string;
  name: string;
  srcLang: string;
  tgtLang: string;
  stats: { entryCount: number };
}

export const TBManager: React.FC = () => {
  const [tbs, setTBs] = useState<TermBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSrc, setNewSrc] = useState('en-US');
  const [newTgt, setNewTgt] = useState('zh-CN');

  const [importingTBId, setImportingTBId] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<any[][]>([]);
  const [importFilePath, setImportFilePath] = useState<string | null>(null);
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

  const loadTBs = async () => {
    setLoading(true);
    try {
      const data = await window.api.listTBs();
      setTBs(data);
    } catch (error) {
      console.error('Failed to load term bases', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTBs();
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;

    try {
      await window.api.createTB(newName.trim(), newSrc.trim(), newTgt.trim());
      setNewName('');
      setShowCreate(false);
      await loadTBs();
    } catch (error) {
      alert('Failed to create term base.');
    }
  };

  const handleDelete = async (tbId: string) => {
    if (!confirm('Are you sure you want to delete this term base? All terms will be deleted.')) return;
    try {
      await window.api.deleteTB(tbId);
      await loadTBs();
    } catch (error) {
      alert('Failed to delete term base.');
    }
  };

  const handleStartImport = async (tbId: string) => {
    const filePath = await window.api.openFileDialog([
      { name: 'Spreadsheets', extensions: ['xlsx', 'xls', 'csv'] }
    ]);
    if (!filePath) return;

    try {
      const preview = await window.api.getTBImportPreview(filePath);
      setImportingTBId(tbId);
      setImportFilePath(filePath);
      setImportPreview(preview);
      setIsImportWizardOpen(true);
    } catch (error) {
      alert('Failed to read file for preview.');
    }
  };

  const handleConfirmImport = async (options: any) => {
    if (!importingTBId || !importFilePath) return;

    try {
      const result = await window.api.importTBEntries(importingTBId, importFilePath, options);
      setIsImportWizardOpen(false);
      alert(`Import completed!\nSuccess: ${result.success}\nSkipped: ${result.skipped}`);
      await loadTBs();
    } catch (error) {
      alert('Import failed.');
      setIsImportWizardOpen(false);
    } finally {
      setImportingTBId(null);
      setImportFilePath(null);
    }
  };

  return (
    <div className="flex-1 p-8 bg-gray-50 overflow-y-auto">
      <TBImportWizard
        isOpen={isImportWizardOpen}
        previewData={importPreview}
        onClose={() => setIsImportWizardOpen(false)}
        onConfirm={handleConfirmImport}
      />

      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">TB Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage reusable term bases for consistency.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm"
          >
            Create Term Base
          </button>
        </div>

        {showCreate && (
          <div className="mb-8 p-6 bg-white rounded-xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Create New Term Base</h2>
            <form onSubmit={handleCreate} className="grid grid-cols-4 gap-4 items-end">
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                  placeholder="e.g. Product Glossary"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Source</label>
                <input
                  type="text"
                  value={newSrc}
                  onChange={(e) => setNewSrc(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Target</label>
                <input
                  type="text"
                  value={newTgt}
                  onChange={(e) => setNewTgt(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div className="col-span-4 flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-black transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-sm text-gray-400">Loading term bases...</p>
          </div>
        ) : tbs.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <div className="text-3xl mb-4">📘</div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">No term base found</h3>
            <p className="text-xs text-gray-500 mb-6">Create one to enforce terminology consistency.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="text-emerald-600 text-sm font-bold hover:underline"
            >
              + Create your first term base
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tbs.map((tb) => (
              <div key={tb.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:border-emerald-200 transition-colors group">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">{tb.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        {tb.srcLang} → {tb.tgtLang}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartImport(tb.id)}
                      className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                      title="Import terms from file"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(tb.id)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete term base"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Size</span>
                    <span className="text-sm font-bold text-gray-700">{tb.stats.entryCount} terms</span>
                  </div>
                  <div className="text-[10px] text-gray-400 font-medium">
                    Last updated {new Date().toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
