import { Agent, ProxyAgent, setGlobalDispatcher } from 'undici';
import type { ProxySettings, ProxySettingsInput } from '../../../shared/ipc';

type ProxyMode = ProxySettings['mode'];
type ProxyEnvKey = 'HTTPS_PROXY' | 'HTTP_PROXY' | 'ALL_PROXY';

const PROXY_ENV_KEYS: ProxyEnvKey[] = ['HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY'];
const SUPPORTED_PROXY_PROTOCOLS = new Set(['http:', 'https:', 'socks:', 'socks5:']);

function captureProxyEnv(): Record<ProxyEnvKey, string | undefined> {
  return {
    HTTPS_PROXY: process.env.HTTPS_PROXY,
    HTTP_PROXY: process.env.HTTP_PROXY,
    ALL_PROXY: process.env.ALL_PROXY,
  };
}

function readProxyFromEnv(env: Record<string, string | undefined>): string | undefined {
  const raw = env.HTTPS_PROXY || env.HTTP_PROXY || env.ALL_PROXY;
  const normalized = raw?.trim();
  return normalized ? normalized : undefined;
}

function isProxyMode(value: unknown): value is ProxyMode {
  return value === 'off' || value === 'system' || value === 'custom';
}

function validateProxyUrl(proxyUrl: string): string {
  const normalized = proxyUrl.trim();
  if (!normalized) {
    throw new Error('Custom proxy URL is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error('Custom proxy URL is not a valid URL');
  }

  if (!SUPPORTED_PROXY_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`Unsupported proxy protocol: ${parsed.protocol}`);
  }

  return normalized;
}

export interface ProxySettingsApplier {
  getEffectiveProxyUrl(): string | undefined;
  applySettings(input: ProxySettingsInput): ProxySettings;
}

export class ProxySettingsManager implements ProxySettingsApplier {
  private readonly baseEnv: Record<ProxyEnvKey, string | undefined>;

  constructor(baseEnv: Record<ProxyEnvKey, string | undefined> = captureProxyEnv()) {
    this.baseEnv = baseEnv;
  }

  public getEffectiveProxyUrl(): string | undefined {
    return readProxyFromEnv(process.env);
  }

  public applySettings(input: ProxySettingsInput): ProxySettings {
    const mode = isProxyMode(input.mode) ? input.mode : 'system';

    if (mode === 'off') {
      this.clearProxyEnv();
      setGlobalDispatcher(new Agent());
      return {
        mode: 'off',
        customProxyUrl: input.customProxyUrl?.trim() || '',
        effectiveProxyUrl: undefined,
      };
    }

    if (mode === 'system') {
      this.restoreBaseProxyEnv();
      const effectiveProxyUrl = this.getEffectiveProxyUrl();
      this.applyDispatcherByProxyUrl(effectiveProxyUrl);
      return {
        mode: 'system',
        customProxyUrl: input.customProxyUrl?.trim() || '',
        effectiveProxyUrl,
      };
    }

    const customProxyUrl = validateProxyUrl(input.customProxyUrl ?? '');
    this.setProxyEnv(customProxyUrl);
    setGlobalDispatcher(new ProxyAgent(customProxyUrl));
    return {
      mode: 'custom',
      customProxyUrl,
      effectiveProxyUrl: customProxyUrl,
    };
  }

  private applyDispatcherByProxyUrl(proxyUrl?: string) {
    if (!proxyUrl) {
      setGlobalDispatcher(new Agent());
      return;
    }
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
  }

  private clearProxyEnv() {
    PROXY_ENV_KEYS.forEach((key) => {
      delete process.env[key];
    });
  }

  private restoreBaseProxyEnv() {
    PROXY_ENV_KEYS.forEach((key) => {
      const value = this.baseEnv[key]?.trim();
      if (value) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    });
  }

  private setProxyEnv(proxyUrl: string) {
    PROXY_ENV_KEYS.forEach((key) => {
      process.env[key] = proxyUrl;
    });
  }
}
