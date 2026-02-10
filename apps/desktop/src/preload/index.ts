import { contextBridge, ipcRenderer } from 'electron';
import { createDesktopApi } from './api/createDesktopApi';

const electronAPI = {
  versions: process.versions,
  platform: process.platform
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
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
