declare module 'xlsx-populate'
/// <reference types="vite/client" />

interface Window {
  api: {
    openFile: () => Promise<{ path: string; content: any[][] } | null>
    saveFile: (defaultPath: string, content: any[][], originalPath?: string, targetColIndex?: number) => Promise<string | boolean>
    updateTM: (source: string, target: string) => Promise<boolean>
    queryTMBatch: (sources: string[]) => Promise<Record<string, string>>
    importTM: () => Promise<number>
    fuzzySearchTM: (query: string) => Promise<Array<{ source: string; target: string; score: number }>>
  }
}
