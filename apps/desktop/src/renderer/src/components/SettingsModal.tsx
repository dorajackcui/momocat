import React, { useEffect, useState } from 'react';
import type { ProxyMode, ProxySettings } from '../../../shared/ipc';
import { apiClient } from '../services/apiClient';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyHint, setApiKeyHint] = useState<string | null>(null);
  const [proxyMode, setProxyMode] = useState<ProxyMode>('system');
  const [customProxyUrl, setCustomProxyUrl] = useState('');
  const [effectiveProxyUrl, setEffectiveProxyUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [savingProxy, setSavingProxy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStatus(null);
    setApiKeyInput('');

    const load = async () => {
      try {
        const [aiSettings, proxySettings] = await Promise.all([
          apiClient.getAISettings(),
          apiClient.getProxySettings(),
        ]);

        if (aiSettings.apiKeySet && aiSettings.apiKeyLast4) {
          setApiKeyHint(`****${aiSettings.apiKeyLast4}`);
        } else {
          setApiKeyHint(null);
        }

        setProxyMode(proxySettings.mode);
        setCustomProxyUrl(proxySettings.customProxyUrl);
        setEffectiveProxyUrl(proxySettings.effectiveProxyUrl ?? null);
      } catch {
        setApiKeyHint(null);
        setProxyMode('system');
        setCustomProxyUrl('');
        setEffectiveProxyUrl(null);
      }
    };

    load();
  }, [isOpen]);

  if (!isOpen) return null;

  const busy = loading || clearing || testing || savingProxy;

  const applyProxySettings = async (): Promise<ProxySettings> => {
    const updated = await apiClient.setProxySettings({
      mode: proxyMode,
      customProxyUrl,
    });
    setProxyMode(updated.mode);
    setCustomProxyUrl(updated.customProxyUrl);
    setEffectiveProxyUrl(updated.effectiveProxyUrl ?? null);
    return updated;
  };

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
    } catch {
      setStatus('Failed to save API key.');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const proxySettings = await applyProxySettings();
      const key = apiKeyInput.trim() || undefined;
      await apiClient.testAIConnection(key);
      if (proxySettings.effectiveProxyUrl) {
        setStatus(`Connection successful via proxy: ${proxySettings.effectiveProxyUrl}`);
      } else {
        setStatus('Connection successful with direct connection.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Connection failed: ${message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveProxy = async () => {
    setSavingProxy(true);
    setStatus(null);
    try {
      const proxySettings = await applyProxySettings();
      if (proxySettings.effectiveProxyUrl) {
        setStatus(`Proxy applied: ${proxySettings.effectiveProxyUrl}`);
      } else {
        setStatus('Proxy disabled. Direct connection will be used.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Failed to save proxy settings: ${message}`);
    } finally {
      setSavingProxy(false);
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
    } catch {
      setStatus('Failed to remove saved API key.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card max-w-lg animate-in fade-in zoom-in duration-200">
        <div className="modal-header">
          <h2 className="text-xl font-bold text-text">AI & Network Settings</h2>
          <button
            onClick={onClose}
            className="text-text-faint hover:text-text-muted transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <section className="surface-subtle p-4 space-y-3">
            <h3 className="text-sm font-bold text-text">API Key Settings</h3>
            <div>
              <label className="field-label">OpenAI API Key</label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="sk-..."
                className="field-input"
              />
              {apiKeyHint && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-text-muted">Saved key: {apiKeyHint}</p>
                  <button
                    onClick={handleClear}
                    disabled={busy}
                    className="text-[11px] font-semibold text-danger hover:text-danger-hover disabled:opacity-50 transition-colors"
                  >
                    {clearing ? 'Removing...' : 'Delete Saved Key'}
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={handleTest} disabled={busy} className="btn-secondary flex-1">
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              <button onClick={handleSave} disabled={busy} className="btn-primary flex-1">
                {loading ? 'Saving...' : 'Save Key'}
              </button>
            </div>
          </section>

          <section className="surface-card p-4 space-y-3">
            <h3 className="text-sm font-bold text-text">Proxy Settings</h3>
            <div className="space-y-2 text-sm text-text-muted">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="proxy-mode"
                  checked={proxyMode === 'off'}
                  onChange={() => setProxyMode('off')}
                  className="accent-brand"
                />
                <span>No Proxy (Direct)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="proxy-mode"
                  checked={proxyMode === 'system'}
                  onChange={() => setProxyMode('system')}
                  className="accent-brand"
                />
                <span>Use System/Environment Proxy</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="proxy-mode"
                  checked={proxyMode === 'custom'}
                  onChange={() => setProxyMode('custom')}
                  className="accent-brand"
                />
                <span>Use Custom Proxy URL</span>
              </label>
            </div>

            {proxyMode === 'custom' && (
              <input
                type="text"
                value={customProxyUrl}
                onChange={(e) => setCustomProxyUrl(e.target.value)}
                placeholder="http://127.0.0.1:7890"
                className="field-input"
              />
            )}

            <p className="text-[11px] text-text-muted">
              Active proxy: {effectiveProxyUrl || 'None (direct)'}
            </p>

            <button onClick={handleSaveProxy} disabled={busy} className="btn-secondary w-full">
              {savingProxy ? 'Saving Proxy...' : 'Save Proxy Settings'}
            </button>
          </section>

          {status && <div className="status-note">{status}</div>}
        </div>
      </div>
    </div>
  );
}
