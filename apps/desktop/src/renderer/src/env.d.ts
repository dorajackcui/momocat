import { ElectronAPI } from '@electron-toolkit/preload';

declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      listProjects: () => Promise<any[]>;
      createProject: (filePath: string, srcLang: string, tgtLang: string, options: any) => Promise<any>;
      getSegments: (projectId: number, offset: number, limit: number) => Promise<any[]>;
      exportProject: (projectId: number, outputPath: string, options: any) => Promise<void>;
      updateSegment: (segmentId: string, targetTokens: any[], status: string) => Promise<void>;
      openFileDialog: (filters: any[]) => Promise<string | null>;
      saveFileDialog: (defaultPath: string, filters: any[]) => Promise<string | null>;
      onJobProgress: (callback: (progress: any) => void) => () => void;
    };
  }
}
