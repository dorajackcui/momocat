declare module 'xlsx-populate';
/// <reference types="vite/client" />

interface Window {
  api: {
    openFile: () => Promise<{ path: string; content: any[][] } | null>;
    saveFile: (
      defaultPath: string,
      content: any[][],
      originalPath?: string,
      targetColIndex?: number,
    ) => Promise<string | boolean>;
    updateTM: (source: string, target: string) => Promise<boolean>;
    queryTMBatch: (sources: string[]) => Promise<Record<string, string>>;
    importTM: () => Promise<number>;
    fuzzySearchTM: (
      query: string,
    ) => Promise<Array<{ source: string; target: string; score: number }>>;
    // Project APIs
    getFiles: () => Promise<any[]>;
    addFiles: () => Promise<any[]>;
    deleteFile: (id: number) => Promise<boolean>;
    openProjectFile: (id: number) => Promise<any>;
    saveProgress: (id: number, segments: any[], colMapping: any) => Promise<boolean>;
    batchMatchTM: (id: number) => Promise<number>;
  };
}
