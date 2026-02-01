import React, { useState, useEffect } from 'react';
import { TMImportWizard } from './TMImportWizard';

interface TM {
  id: string;
  name: string;
  srcLang: string;
  tgtLang: string;
  type: 'working' | 'main';
  stats: { entryCount: number };
}

export const TMManager: React.FC = () => {
  const [tms, setTMs] = useState<TM[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSrc, setNewSrc] = useState('en-US');
  const [newTgt, setNewTgt] = useState('zh-CN');

  // Import State
  const [importingTMId, setImportingTMId] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<any[][]>([]);
  const [importFilePath, setImportFilePath] = useState<string | null>(null);
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const loadTMs = async () => {
    setLoading(true);
    try {
      const data = await window.api.listTMs('main');
      setTMs(data);
    } catch (e) {
      console.error('Failed to load TMs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTMs();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    try {
      await window.api.createTM(newName, newSrc, newTgt, 'main');
      setNewName('');
      setShowCreate(false);
      loadTMs();
    } catch (e) {
      alert('Failed to create TM');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Main TM? All data inside will be lost.')) return;
    try {
      await window.api.deleteTM(id);
      loadTMs();
    } catch (e) {
      alert('Failed to delete TM');
    }
  };

  const handleStartImport = async (tmId: string) => {
    const filePath = await window.api.openFileDialog([
      { name: 'Spreadsheets', extensions: ['xlsx', 'xls', 'csv'] }
    ]);
    if (!filePath) return;

    try {
      const preview = await window.api.getTMImportPreview(filePath);
      setImportingTMId(tmId);
      setImportFilePath(filePath);
      setImportPreview(preview);
      setIsImportWizardOpen(true);
    } catch (e) {
      alert('Failed to read file for preview');
    }
  };

  const handleConfirmImport = async (options: any) => {
    if (!importingTMId || !importFilePath) return;
    
    setIsImporting(true);
    setIsImportWizardOpen(false);
    
    try {
      const result = await window.api.importTMEntries(importingTMId, importFilePath, options);
      alert(`Import completed!\nSuccess: ${result.success}\nSkipped: ${result.skipped}`);
      loadTMs();
    } catch (e) {
      alert('Import failed');
    } finally {
      setIsImporting(false);
      setImportingTMId(null);
      setImportFilePath(null);
    }
  };

  return (
    <div className="flex-1 p-8 bg-gray-50 overflow-y-auto">
      <TMImportWizard 
        isOpen={isImportWizardOpen}
        previewData={importPreview}
        onClose={() => setIsImportWizardOpen(false)}
        onConfirm={handleConfirmImport}
      />

      {isImporting && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[200] flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl shadow-xl flex items-center gap-4">
            <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span className="text-sm font-bold text-gray-700">Importing TM entries, please wait...</span>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">TM Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your Main Translation Memories (受控资产)</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
          >
            Create Main TM
          </button>
        </div>

        {showCreate && (
          <div className="mb-8 p-6 bg-white rounded-xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Create New Main TM</h2>
            <form onSubmit={handleCreate} className="grid grid-cols-4 gap-4 items-end">
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">TM Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="e.g. Technical Glossary"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Source</label>
                <input
                  type="text"
                  value={newSrc}
                  onChange={(e) => setNewSrc(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Target</label>
                <input
                  type="text"
                  value={newTgt}
                  onChange={(e) => setNewTgt(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none"
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
                  Save TM
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-sm text-gray-400">Loading TM assets...</p>
          </div>
        ) : tms.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <div className="text-3xl mb-4">📚</div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">No Main TMs found</h3>
            <p className="text-xs text-gray-500 mb-6">Create a Main TM to store your verified high-quality translations.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="text-blue-600 text-sm font-bold hover:underline"
            >
              + Create your first Main TM
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tms.map((tm) => (
              <div key={tm.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:border-blue-200 transition-colors group">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{tm.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        {tm.srcLang} → {tm.tgtLang}
                      </span>
                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        Main TM
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartImport(tm.id)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Import from Excel/CSV"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(tm.id)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete TM"
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
                    <span className="text-sm font-bold text-gray-700">{tm.stats.entryCount} segments</span>
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
