import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  versions: process.versions,
  platform: process.platform
};

// Typed IPC Contract
const api = {
  // Projects
  listProjects: () => ipcRenderer.invoke('project-list'),
  createProject: (name: string, srcLang: string, tgtLang: string) => 
    ipcRenderer.invoke('project-create', name, srcLang, tgtLang),
  deleteProject: (projectId: number) => ipcRenderer.invoke('project-delete', projectId),
  getProject: (projectId: number) => ipcRenderer.invoke('project-get', projectId),
  updateProjectPrompt: (projectId: number, aiPrompt: string | null) =>
    ipcRenderer.invoke('project-update-prompt', projectId, aiPrompt),
  updateProjectAISettings: (projectId: number, aiPrompt: string | null, aiTemperature: number | null) =>
    ipcRenderer.invoke('project-update-ai-settings', projectId, aiPrompt, aiTemperature),
  getProjectFiles: (projectId: number) => ipcRenderer.invoke('project-get-files', projectId),
  getFile: (fileId: number) => ipcRenderer.invoke('file-get', fileId),
  getFilePreview: (filePath: string) => ipcRenderer.invoke('file-get-preview', filePath),
  deleteFile: (fileId: number) => ipcRenderer.invoke('file-delete', fileId),
  addFileToProject: (projectId: number, filePath: string, options: any) =>
    ipcRenderer.invoke('project-add-file', projectId, filePath, options),

  // Files & Segments
  getSegments: (fileId: number, offset: number, limit: number) => 
    ipcRenderer.invoke('file-get-segments', fileId, offset, limit),
  exportFile: (fileId: number, outputPath: string, options?: any, forceExport?: boolean) =>
    ipcRenderer.invoke('file-export', fileId, outputPath, options, forceExport),
  
  // Segments
  updateSegment: (segmentId: string, targetTokens: any[], status: string) =>
    ipcRenderer.invoke('segment-update', segmentId, targetTokens, status),
  
  // TM & Search
  get100Match: (projectId: number, srcHash: string) =>
    ipcRenderer.invoke('tm-get-100-match', projectId, srcHash),
  getMatches: (projectId: number, segment: any) =>
    ipcRenderer.invoke('tm-get-matches', projectId, segment),
  searchConcordance: (projectId: number, query: string) =>
    ipcRenderer.invoke('tm-concordance', projectId, query),
  getTermMatches: (projectId: number, segment: any) =>
    ipcRenderer.invoke('tb-get-matches', projectId, segment),
  
  // TM Management
  listTMs: (type?: 'working' | 'main') => ipcRenderer.invoke('tm-list', type),
  createTM: (name: string, srcLang: string, tgtLang: string, type?: 'working' | 'main') => 
    ipcRenderer.invoke('tm-create', name, srcLang, tgtLang, type),
  deleteTM: (tmId: string) => ipcRenderer.invoke('tm-delete', tmId),
  getProjectMountedTMs: (projectId: number) => ipcRenderer.invoke('tm-project-mounted', projectId),
  mountTMToProject: (projectId: number, tmId: string, priority?: number, permission?: string) => 
    ipcRenderer.invoke('tm-mount', projectId, tmId, priority, permission),
  unmountTMFromProject: (projectId: number, tmId: string) => ipcRenderer.invoke('tm-unmount', projectId, tmId),
  commitToMainTM: (tmId: string, fileId: number) => ipcRenderer.invoke('tm-commit-file', tmId, fileId),
  matchFileWithTM: (fileId: number, tmId: string) => ipcRenderer.invoke('tm-match-file', fileId, tmId),
  getTMImportPreview: (filePath: string) => ipcRenderer.invoke('tm-import-preview', filePath),
  importTMEntries: (tmId: string, filePath: string, options: any) => ipcRenderer.invoke('tm-import-execute', tmId, filePath, options),

  // TB Management
  listTBs: () => ipcRenderer.invoke('tb-list'),
  createTB: (name: string, srcLang: string, tgtLang: string) =>
    ipcRenderer.invoke('tb-create', name, srcLang, tgtLang),
  deleteTB: (tbId: string) => ipcRenderer.invoke('tb-delete', tbId),
  getProjectMountedTBs: (projectId: number) => ipcRenderer.invoke('tb-project-mounted', projectId),
  mountTBToProject: (projectId: number, tbId: string, priority?: number) =>
    ipcRenderer.invoke('tb-mount', projectId, tbId, priority),
  unmountTBFromProject: (projectId: number, tbId: string) => ipcRenderer.invoke('tb-unmount', projectId, tbId),
  getTBImportPreview: (filePath: string) => ipcRenderer.invoke('tb-import-preview', filePath),
  importTBEntries: (tbId: string, filePath: string, options: any) => ipcRenderer.invoke('tb-import-execute', tbId, filePath, options),

  // AI Settings & Translation
  getAISettings: () => ipcRenderer.invoke('ai-settings-get'),
  setAIKey: (apiKey: string) => ipcRenderer.invoke('ai-settings-set', apiKey),
  clearAIKey: () => ipcRenderer.invoke('ai-settings-clear'),
  testAIConnection: (apiKey?: string) => ipcRenderer.invoke('ai-test-connection', apiKey),
  aiTranslateFile: (fileId: number) => ipcRenderer.invoke('ai-translate-file', fileId),
  aiTestTranslate: (projectId: number, sourceText: string) => ipcRenderer.invoke('ai-test-translate', projectId, sourceText),
  
  // Dialogs
  openFileDialog: (filters: any[]) => ipcRenderer.invoke('dialog-open-file', filters),
  saveFileDialog: (defaultPath: string, filters: any[]) => ipcRenderer.invoke('dialog-save-file', defaultPath, filters),

  // Events
  onSegmentsUpdated: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on('segments-updated', listener);
    return () => ipcRenderer.removeListener('segments-updated', listener);
  },
  onProgress: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on('app-progress', listener);
    return () => ipcRenderer.removeListener('app-progress', listener);
  },
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
