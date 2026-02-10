import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyHint, setApiKeyHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStatus(null);
    setApiKeyInput('');

    const load = async () => {
      try {
        const settings = await apiClient.getAISettings();
        if (settings.apiKeySet && settings.apiKeyLast4) {
          setApiKeyHint(`****${settings.apiKeyLast4}`);
        } else {
          setApiKeyHint(null);
        }
      } catch (error) {
        setApiKeyHint(null);
      }
    };

    load();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const key = apiKeyInput.trim();
    if (!key) {
      setStatus('Please enter an API key.');
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      await apiClient.setAIKey(key);
      setApiKeyHint(`****${key.slice(-4)}`);
      setApiKeyInput('');
      setStatus('API key saved. You can run a test now.');
    } catch (error) {
      setStatus('Failed to save API key.');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const key = apiKeyInput.trim() || undefined;
      await apiClient.testAIConnection(key);
      setStatus('Connection successful.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Connection failed: ${message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    setStatus(null);
    try {
      await apiClient.clearAIKey();
      setApiKeyHint(null);
      setApiKeyInput('');
      setStatus('Saved API key removed.');
    } catch (error) {
      setStatus('Failed to remove saved API key.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">AI Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">OpenAI API Key</label>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="sk-..."
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
            {apiKeyHint && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[11px] text-gray-500">Saved key: {apiKeyHint}</p>
                <button
                  onClick={handleClear}
                  disabled={clearing || loading || testing}
                  className="text-[11px] font-semibold text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
                >
                  {clearing ? 'Removing...' : 'Delete Saved Key'}
                </button>
              </div>
            )}
          </div>

          {status && (
            <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              {status}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleTest}
              disabled={testing || loading || clearing}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg font-bold hover:bg-gray-50 transition-colors"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              onClick={handleSave}
              disabled={loading || testing || clearing}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg shadow-blue-200"
            >
              {loading ? 'Saving...' : 'Save Key'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
