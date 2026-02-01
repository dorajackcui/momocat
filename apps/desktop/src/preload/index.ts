import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// Typed IPC Contract
const api = {
  // Projects
  listProjects: () => ipcRenderer.invoke('project-list'),
  createProject: (filePath: string, srcLang: string, tgtLang: string, options: any) => 
    ipcRenderer.invoke('project-create', filePath, srcLang, tgtLang, options),
  getSegments: (projectId: number, offset: number, limit: number) => 
    ipcRenderer.invoke('project-get-segments', projectId, offset, limit),
  exportProject: (projectId: number, outputPath: string, options: any) =>
    ipcRenderer.invoke('project-export', projectId, outputPath, options),
  
  // Segments
  updateSegment: (segmentId: string, targetTokens: any[], status: string) =>
    ipcRenderer.invoke('segment-update', segmentId, targetTokens, status),
  
  // Dialogs
  openFileDialog: (filters: any[]) => ipcRenderer.invoke('dialog-open-file', filters),
  saveFileDialog: (defaultPath: string, filters: any[]) => ipcRenderer.invoke('dialog-save-file', defaultPath, filters),
  
  // Events
  onJobProgress: (callback: (progress: any) => void) => {
    const listener = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('job-progress', listener);
    return () => ipcRenderer.removeListener('job-progress', listener);
  }
};

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
