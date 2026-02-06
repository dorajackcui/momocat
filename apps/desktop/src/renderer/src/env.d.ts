import { ElectronAPI } from '@electron-toolkit/preload';

declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      listProjects: () => Promise<any[]>;
      createProject: (name: string, srcLang: string, tgtLang: string) => Promise<any>;
      deleteProject: (projectId: number) => Promise<void>;
      getProject: (projectId: number) => Promise<any>;
      updateProjectPrompt: (projectId: number, aiPrompt: string | null) => Promise<void>;
      getProjectFiles: (projectId: number) => Promise<any[]>;
      getFile: (fileId: number) => Promise<any>;
      getFilePreview: (filePath: string) => Promise<any[][]>;
      deleteFile: (fileId: number) => Promise<void>;
      addFileToProject: (projectId: number, filePath: string, options: any) => Promise<any>;
      getSegments: (fileId: number, offset: number, limit: number) => Promise<any[]>;
      exportFile: (fileId: number, outputPath: string, options?: any, forceExport?: boolean) => Promise<void>;
      updateSegment: (segmentId: string, targetTokens: any[], status: string) => Promise<any>;
      get100Match: (projectId: number, srcHash: string) => Promise<any>;
      getMatches: (projectId: number, segment: any) => Promise<any[]>;
      searchConcordance: (projectId: number, query: string) => Promise<any[]>;
      onSegmentsUpdated: (callback: (data: any) => void) => () => void;
      onProgress: (callback: (data: any) => void) => () => void;
      
      // TM Management
      listTMs: (type?: 'working' | 'main') => Promise<any[]>;
      createTM: (name: string, srcLang: string, tgtLang: string, type?: 'working' | 'main') => Promise<string>;
      deleteTM: (tmId: string) => Promise<void>;
      getProjectMountedTMs: (projectId: number) => Promise<any[]>;
      mountTMToProject: (projectId: number, tmId: string, priority?: number, permission?: string) => Promise<void>;
      unmountTMFromProject: (projectId: number, tmId: string) => Promise<void>;
      commitToMainTM: (tmId: string, fileId: number) => Promise<number>;
      getTMImportPreview: (filePath: string) => Promise<any[][]>;
      importTMEntries: (tmId: string, filePath: string, options: any) => Promise<{ success: number; skipped: number }>;

      // AI Settings & Translation
      getAISettings: () => Promise<{ apiKeySet: boolean; apiKeyLast4?: string }>;
      setAIKey: (apiKey: string) => Promise<void>;
      testAIConnection: (apiKey?: string) => Promise<{ ok: boolean }>;
      aiTranslateFile: (fileId: number) => Promise<string>;
      aiTestTranslate: (projectId: number, sourceText: string) => Promise<{
        ok: boolean;
        error?: string;
        promptUsed: string;
        userMessage: string;
        translatedText: string;
        requestId?: string;
        status?: number;
        endpoint?: string;
        model?: string;
        rawResponseText?: string;
        responseContent?: string;
      }>;

      openFileDialog: (filters: any[]) => Promise<string | null>;
      saveFileDialog: (defaultPath: string, filters: any[]) => Promise<string | null>;
      onJobProgress: (callback: (progress: any) => void) => () => void;
    };
  }
}
