import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// Typed IPC Contract
const api = {
  // Projects
  listProjects: () => ipcRenderer.invoke('project-list'),
  createProject: (name: string, srcLang: string, tgtLang: string) => 
    ipcRenderer.invoke('project-create', name, srcLang, tgtLang),
  deleteProject: (projectId: number) => ipcRenderer.invoke('project-delete', projectId),
  getProject: (projectId: number) => ipcRenderer.invoke('project-get', projectId),
  getProjectFiles: (projectId: number) => ipcRenderer.invoke('project-get-files', projectId),
  getFile: (fileId: number) => ipcRenderer.invoke('file-get', fileId),
  getFilePreview: (filePath: string) => ipcRenderer.invoke('file-get-preview', filePath),
  deleteFile: (fileId: number) => ipcRenderer.invoke('file-delete', fileId),
  addFileToProject: (projectId: number, filePath: string, options: any) =>
    ipcRenderer.invoke('project-add-file', projectId, filePath, options),

  // Files & Segments
  getSegments: (fileId: number, offset: number, limit: number) => 
    ipcRenderer.invoke('file-get-segments', fileId, offset, limit),
  exportFile: (fileId: number, outputPath: string, options: any) =>
    ipcRenderer.invoke('file-export', fileId, outputPath, options),
  
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
