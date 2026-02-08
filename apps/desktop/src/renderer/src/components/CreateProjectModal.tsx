import React, { useState } from 'react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, srcLang: string, tgtLang: string) => void;
  loading: boolean;
}

const LANGUAGE_OPTIONS = [
  { label: 'Chinese (zh-CN)', value: 'zh-CN' },
  { label: 'English (en-US)', value: 'en-US' },
  { label: 'Japanese (ja-JP)', value: 'ja-JP' },
  { label: 'Korean (ko-KR)', value: 'ko-KR' },
  { label: 'German (de-DE)', value: 'de-DE' },
  { label: 'French (fr-FR)', value: 'fr-FR' },
  { label: 'Spanish (es-ES)', value: 'es-ES' },
  { label: 'Italian (it-IT)', value: 'it-IT' },
  { label: 'Portuguese (pt-PT)', value: 'pt-PT' },
  { label: 'Thai (th-TH)', value: 'th-TH' },
  { label: 'Bahasa Indonesia (id-ID)', value: 'id-ID' }
] as const;

export function CreateProjectModal({ isOpen, onClose, onConfirm, loading }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [srcLang, setSrcLang] = useState('zh-CN');
  const [tgtLang, setTgtLang] = useState('en-US');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedSrcLang = srcLang.trim();
    const trimmedTgtLang = tgtLang.trim();
    if (trimmedName && trimmedSrcLang && trimmedTgtLang) {
      onConfirm(trimmedName, trimmedSrcLang, trimmedTgtLang);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Create New Project</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Project Name</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q1 Marketing Campaign"
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Source Language</label>
              <select
                value={srcLang}
                onChange={(e) => setSrcLang(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                required
              >
                {LANGUAGE_OPTIONS.map((language) => (
                  <option key={language.value} value={language.value}>
                    {language.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Target Language</label>
              <select
                value={tgtLang}
                onChange={(e) => setTgtLang(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                required
              >
                {LANGUAGE_OPTIONS.map((language) => (
                  <option key={language.value} value={language.value}>
                    {language.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg font-bold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || !srcLang.trim() || !tgtLang.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg shadow-blue-200"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
