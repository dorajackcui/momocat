import { Project, ProjectFile, Segment, SegmentStatus, TBEntry, TMEntry, Token } from '@cat/core';

export type TMType = 'working' | 'main';
export type SpreadsheetPreviewCell = string | number | boolean | null | undefined;
export type SpreadsheetPreviewData = SpreadsheetPreviewCell[][];

export type ProjectRecord = Project;
export type ProjectListRecord = Project & { progress: number; fileCount: number };

export type ProjectFileRecord = ProjectFile & { importOptionsJson?: string | null };

export interface TMRecord {
  id: string;
  name: string;
  srcLang: string;
  tgtLang: string;
  type: TMType;
  createdAt: string;
  updatedAt: string;
}

export interface MountedTMRecord extends TMRecord {
  priority: number;
  permission: string;
  isEnabled: number;
}

export interface TBRecord {
  id: string;
  name: string;
  srcLang: string;
  tgtLang: string;
  createdAt: string;
  updatedAt: string;
}

export interface MountedTBRecord extends TBRecord {
  priority: number;
  isEnabled: number;
}

export interface ProjectRepository {
  createProject(name: string, srcLang: string, tgtLang: string): number;
  listProjects(): ProjectListRecord[];
  getProject(id: number): ProjectRecord | undefined;
  updateProjectPrompt(projectId: number, aiPrompt: string | null): void;
  updateProjectAISettings(projectId: number, aiPrompt: string | null, aiTemperature: number | null): void;
  deleteProject(id: number): void;

  createFile(projectId: number, name: string, importOptionsJson?: string): number;
  listFiles(projectId: number): ProjectFileRecord[];
  getFile(id: number): ProjectFileRecord | undefined;
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

  listTMs(type?: TMType): TMRecord[];
  createTM(name: string, srcLang: string, tgtLang: string, type: TMType): string;
  deleteTM(id: string): void;
  getTM(tmId: string): TMRecord | undefined;
  getTMStats(tmId: string): { entryCount: number };
  getProjectMountedTMs(projectId: number): MountedTMRecord[];
  mountTMToProject(projectId: number, tmId: string, priority?: number, permission?: string): void;
  unmountTMFromProject(projectId: number, tmId: string): void;
}

export interface TBRepository {
  listTermBases(): TBRecord[];
  createTermBase(name: string, srcLang: string, tgtLang: string): string;
  deleteTermBase(id: string): void;
  getTermBase(tbId: string): TBRecord | undefined;
  getTermBaseStats(tbId: string): { entryCount: number };
  getProjectMountedTermBases(projectId: number): MountedTBRecord[];
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
  getPreview(filePath: string, rowLimit?: number): Promise<SpreadsheetPreviewData>;
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
