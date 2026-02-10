import { ElectronAPI } from '@electron-toolkit/preload';
import type { DesktopApi } from '../../shared/ipc';

declare global {
  interface Window {
    electron: ElectronAPI;
    api: DesktopApi;
  }
}

export {};
