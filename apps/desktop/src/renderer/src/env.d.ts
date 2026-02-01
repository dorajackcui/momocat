import { ElectronAPI } from '@electron-toolkit/preload';

declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      listProjects: () => Promise<any[]>;
      createProject: (name: string, srcLang: string, tgtLang: string) => Promise<any>;
      deleteProject: (projectId: number) => Promise<void>;
      getProject: (projectId: number) => Promise<any>;
      getProjectFiles: (projectId: number) => Promise<any[]>;
      getFile: (fileId: number) => Promise<any>;
      getFilePreview: (filePath: string) => Promise<any[][]>;
      deleteFile: (fileId: number) => Promise<void>;
      addFileToProject: (projectId: number, filePath: string, options: any) => Promise<any>;
      getSegments: (fileId: number, offset: number, limit: number) => Promise<any[]>;
      exportFile: (fileId: number, outputPath: string, options: any) => Promise<void>;
      updateSegment: (segmentId: string, targetTokens: any[], status: string) => Promise<void>;
      openFileDialog: (filters: any[]) => Promise<string | null>;
      saveFileDialog: (defaultPath: string, filters: any[]) => Promise<string | null>;
      onJobProgress: (callback: (progress: any) => void) => () => void;
    };
  }
}
