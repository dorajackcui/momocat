import { contextBridge, ipcRenderer } from 'electron';
import { createDesktopApi } from './api/createDesktopApi';

const electronAPI = {
  versions: process.versions,
  platform: process.platform,
};

const api = createDesktopApi(ipcRenderer);

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  const unsafeWindow = window as unknown as {
    electron: typeof electronAPI;
    api: typeof api;
  };
  unsafeWindow.electron = electronAPI;
  unsafeWindow.api = api;
}
