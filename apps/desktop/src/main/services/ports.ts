import { Segment, SegmentStatus, TBEntry, TMEntry, Token } from '@cat/core';

export interface ProjectRecord {
  id: number;
  name: string;
  srcLang: string;
  tgtLang: string;
  aiPrompt?: string | null;
  aiTemperature?: number | null;
}

export interface ProjectFileRecord {
  id: number;
  projectId: number;
  name: string;
  importOptionsJson?: string | null;
}

export interface ProjectRepository {
  createProject(name: string, srcLang: string, tgtLang: string): number;
  listProjects(): any[];
  getProject(id: number): any | undefined;
  updateProjectPrompt(projectId: number, aiPrompt: string | null): void;
  updateProjectAISettings(projectId: number, aiPrompt: string | null, aiTemperature: number | null): void;
  deleteProject(id: number): void;

  createFile(projectId: number, name: string, importOptionsJson?: string): number;
  listFiles(projectId: number): any[];
  getFile(id: number): any | undefined;
  deleteFile(id: number): void;
}

export interface SegmentRepository {
  bulkInsertSegments(segments: Segment[]): void;
  getSegmentsPage(fileId: number, offset: number, limit: number): Segment[];
  getSegment(segmentId: string): Segment | undefined;
  getProjectIdByFileId(fileId: number): number | undefined;
  getProjectSegmentsByHash(projectId: number, srcHash: string): Segment[];
  updateSegmentTarget(segmentId: string, targetTokens: Token[], status: SegmentStatus): void;
}

export interface TMRepository {
  upsertTMEntryBySrcHash(entry: TMEntry & { tmId: string }): string;
  insertTMEntryIfAbsentBySrcHash(entry: TMEntry & { tmId: string }): string | undefined;
  insertTMFts(tmId: string, srcText: string, tgtText: string, tmEntryId: string): void;
  replaceTMFts(tmId: string, srcText: string, tgtText: string, tmEntryId: string): void;
  findTMEntryByHash(tmId: string, srcHash: string): TMEntry | undefined;
  searchConcordance(projectId: number, query: string): TMEntry[];

  listTMs(type?: 'working' | 'main'): any[];
  createTM(name: string, srcLang: string, tgtLang: string, type: 'working' | 'main'): string;
  deleteTM(id: string): void;
  getTM(tmId: string): any | undefined;
  getTMStats(tmId: string): { entryCount: number };
  getProjectMountedTMs(projectId: number): any[];
  mountTMToProject(projectId: number, tmId: string, priority?: number, permission?: string): void;
  unmountTMFromProject(projectId: number, tmId: string): void;
}

export interface TBRepository {
  listTermBases(): any[];
  createTermBase(name: string, srcLang: string, tgtLang: string): string;
  deleteTermBase(id: string): void;
  getTermBase(tbId: string): any | undefined;
  getTermBaseStats(tbId: string): { entryCount: number };
  getProjectMountedTermBases(projectId: number): any[];
  mountTermBaseToProject(projectId: number, tbId: string, priority?: number): void;
  unmountTermBaseFromProject(projectId: number, tbId: string): void;
  listProjectTermEntries(projectId: number): Array<TBEntry & { tbName: string; priority: number }>;
  upsertTBEntryBySrcTerm(params: {
    id: string;
    tbId: string;
    srcTerm: string;
    tgtTerm: string;
    note?: string | null;
    usageCount?: number;
  }): string;
  insertTBEntryIfAbsentBySrcTerm(params: {
    id: string;
    tbId: string;
    srcTerm: string;
    tgtTerm: string;
    note?: string | null;
    usageCount?: number;
  }): string | undefined;
}

export interface SettingsRepository {
  getSetting(key: string): string | undefined;
  setSetting(key: string, value: string | null): void;
}

export interface TransactionManager {
  runInTransaction<T>(fn: () => T): T;
}

// Backward-compatible aggregate type for incremental migration.
export interface DatabaseGateway
  extends ProjectRepository,
    SegmentRepository,
    TMRepository,
    TBRepository,
    SettingsRepository,
    TransactionManager {}

export interface SpreadsheetGateway {
  import(filePath: string, projectId: number, fileId: number, options: ImportOptions): Promise<Segment[]>;
  export(originalFilePath: string, segments: Segment[], options: ImportOptions, outputPath: string): Promise<void>;
  getPreview(filePath: string, rowLimit?: number): Promise<any[][]>;
}

export interface ImportOptions {
  hasHeader: boolean;
  sourceCol: number;
  targetCol: number;
  contextCol?: number;
}

export interface ProgressPayload {
  type: string;
  current: number;
  total: number;
  message?: string;
}

export type ProgressEmitter = (payload: ProgressPayload) => void;

export interface AITransport {
  testConnection(apiKey: string): Promise<{ ok: true }>;
  chatCompletions(params: {
    apiKey: string;
    model: string;
    temperature: number;
    systemPrompt: string;
    userPrompt: string;
  }): Promise<{
    content: string;
    requestId?: string;
    status: number;
    endpoint: string;
    rawResponseText?: string;
  }>;
}
