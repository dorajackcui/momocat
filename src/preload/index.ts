import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// Custom APIs for renderer
const api = {
  openFile: (): Promise<{ path: string; content: string } | null> =>
    ipcRenderer.invoke('open-file-dialog'),
  saveFile: (
    defaultPath: string,
    content: string,
    originalPath?: string,
    targetColIndex?: number,
  ): Promise<string | boolean> =>
    ipcRenderer.invoke('save-file', defaultPath, content, originalPath, targetColIndex),
  updateTM: (source: string, target: string): Promise<boolean> =>
    ipcRenderer.invoke('tm-update', source, target),
  queryTMBatch: (sources: string[]): Promise<Record<string, string>> =>
    ipcRenderer.invoke('tm-query-batch', sources),
  importTM: (): Promise<number> => ipcRenderer.invoke('tm-import'),
  fuzzySearchTM: (
    query: string,
  ): Promise<Array<{ source: string; target: string; score: number }>> =>
    ipcRenderer.invoke('tm-fuzzy-search', query),
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
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
