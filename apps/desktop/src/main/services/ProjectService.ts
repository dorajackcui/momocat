import { CATDatabase } from '@cat/db';
import { SpreadsheetFilter, ImportOptions } from '../filters/SpreadsheetFilter';
import { 
  Project, 
  ProjectFile, 
  Segment, 
  SegmentStatus, 
  Token, 
  validateSegmentTags,
  parseDisplayTextToTokens,
  computeTagsSignature,
  computeMatchKey,
  computeSrcHash
} from '@cat/core';
import { join, basename } from 'path';
import { copyFileSync, existsSync, mkdirSync, rmSync, unlinkSync } from 'fs';
import { randomUUID } from 'crypto';
import { TMService } from './TMService';
import { SegmentService } from './SegmentService';

export class ProjectService {
  private db: CATDatabase;
  private filter: SpreadsheetFilter;
  private projectsDir: string;
  private tmService: TMService;
  private segmentService: SegmentService;
  private progressCallbacks: ((data: { type: string; current: number; total: number; message?: string }) => void)[] = [];

  constructor(db: CATDatabase, projectsDir: string) {
    this.db = db;
    this.filter = new SpreadsheetFilter();
    this.projectsDir = projectsDir;
    this.tmService = new TMService(this.db);
    this.segmentService = new SegmentService(this.db, this.tmService);

    if (!existsSync(this.projectsDir)) {
      mkdirSync(this.projectsDir, { recursive: true });
    }
  }

  public async createProject(
    name: string, 
    srcLang: string, 
    tgtLang: string
  ): Promise<Project> {
    console.log(`[ProjectService] Creating project: ${name}`);
    const projectId = this.db.createProject(name, srcLang, tgtLang);
    
    // Create a dedicated folder for this project
    const projectDir = join(this.projectsDir, projectId.toString());
    if (!existsSync(projectDir)) {
      mkdirSync(projectDir, { recursive: true });
    }
    
    const project = this.db.getProject(projectId);
    if (!project) throw new Error('Failed to retrieve created project');
    return project;
  }

  public async addFileToProject(
    projectId: number,
    filePath: string,
    options: ImportOptions
  ): Promise<ProjectFile> {
    const project = this.db.getProject(projectId);
    if (!project) throw new Error('Project not found');

    console.log(`[ProjectService] Adding file ${filePath} to project ${projectId}`);
    const fileName = basename(filePath);
    const fileId = this.db.createFile(projectId, fileName, JSON.stringify(options));
    
    // Store in project-specific subfolder
    const projectDir = join(this.projectsDir, projectId.toString());
    if (!existsSync(projectDir)) {
      mkdirSync(projectDir, { recursive: true });
    }
    
    const storedPath = join(projectDir, `${fileId}_${fileName}`);
    console.log(`[ProjectService] Storing original file at: ${storedPath}`);
    copyFileSync(filePath, storedPath);
    
    console.log(`[ProjectService] Importing segments...`);
    const segments = await this.filter.import(storedPath, projectId, fileId, options);
    console.log(`[ProjectService] Found ${segments.length} segments`);
    
    if (segments.length === 0) {
      throw new Error('No valid segments found in the selected file.');
    }
    
    this.db.bulkInsertSegments(segments);
    
    const file = this.db.getFile(fileId);
    if (!file) throw new Error('Failed to retrieve created file');
    return file;
  }

  public listProjects() {
    return this.db.listProjects();
  }

  public listFiles(projectId: number) {
    return this.db.listFiles(projectId);
  }

  public getFile(fileId: number) {
    return this.db.getFile(fileId);
  }

  public getProject(projectId: number) {
    return this.db.getProject(projectId);
  }

  public async deleteProject(projectId: number) {
    console.log(`[ProjectService] Deleting project: ${projectId}`);
    this.db.deleteProject(projectId);
    
    const projectDir = join(this.projectsDir, projectId.toString());
    if (existsSync(projectDir)) {
      rmSync(projectDir, { recursive: true, force: true });
    }
  }

  public async deleteFile(fileId: number) {
    const file = this.db.getFile(fileId);
    if (!file) return;

    console.log(`[ProjectService] Deleting file: ${fileId} (${file.name})`);
    this.db.deleteFile(fileId);
    
    const filePath = join(this.projectsDir, file.projectId.toString(), `${file.id}_${file.name}`);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  public getSegments(fileId: number, offset: number, limit: number): Segment[] {
    return this.segmentService.getSegments(fileId, offset, limit);
  }

  public async getSpreadsheetPreview(filePath: string): Promise<any[][]> {
    return this.filter.getPreview(filePath);
  }

  public async updateSegment(segmentId: string, targetTokens: Token[], status: SegmentStatus) {
    return await this.segmentService.updateSegment(segmentId, targetTokens, status);
  }

  public onSegmentsUpdated(callback: (data: any) => void) {
    this.segmentService.on('segments-updated', callback);
    return () => this.segmentService.off('segments-updated', callback);
  }

  public onProgress(callback: (data: { type: string; current: number; total: number; message?: string }) => void) {
    this.progressCallbacks.push(callback);
    return () => {
      this.progressCallbacks = this.progressCallbacks.filter(c => c !== callback);
    };
  }

  private emitProgress(type: string, current: number, total: number, message?: string) {
    this.progressCallbacks.forEach(cb => cb({ type, current, total, message }));
  }

  public async get100Match(projectId: number, srcHash: string) {
    return this.tmService.find100Match(projectId, srcHash);
  }

  public async findMatches(projectId: number, segment: Segment) {
    return this.tmService.findMatches(projectId, segment);
  }

  public async searchConcordance(projectId: number, query: string) {
    return this.db.searchConcordance(projectId, query);
  }

  // TM Management
  public async listTMs(type?: 'working' | 'main') {
    const tms = this.db.listTMs(type);
    return tms.map(tm => ({
      ...tm,
      stats: this.db.getTMStats(tm.id)
    }));
  }

  public async createTM(name: string, srcLang: string, tgtLang: string, type: 'working' | 'main' = 'main') {
    return this.db.createTM(name, srcLang, tgtLang, type);
  }

  public async deleteTM(tmId: string) {
    return this.db.deleteTM(tmId);
  }

  public async getProjectMountedTMs(projectId: number) {
    return this.db.getProjectMountedTMs(projectId);
  }

  public async mountTMToProject(projectId: number, tmId: string, priority?: number, permission?: string) {
    return this.db.mountTMToProject(projectId, tmId, priority, permission);
  }

  public async unmountTMFromProject(projectId: number, tmId: string) {
    return this.db.unmountTMFromProject(projectId, tmId);
  }

  // TM Import Logic
  public async getTMImportPreview(filePath: string): Promise<any[][]> {
    const filter = new SpreadsheetFilter();
    return filter.getPreview(filePath);
  }

  public async importTMEntries(
    tmId: string, 
    filePath: string, 
    options: { sourceCol: number; targetCol: number; hasHeader: boolean; overwrite: boolean }
  ): Promise<{ success: number; skipped: number }> {
    const tm = this.db.getTM(tmId);
    if (!tm) throw new Error('Target TM not found');

    const workbook = require('xlsx').readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = require('xlsx').utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    const startIndex = options.hasHeader ? 1 : 0;
    const totalRows = rawData.length - startIndex;
    let success = 0;
    let skipped = 0;

    // Process in chunks to allow progress reporting and avoid blocking the UI
    const CHUNK_SIZE = 500;
    for (let i = startIndex; i < rawData.length; i += CHUNK_SIZE) {
      const end = Math.min(i + CHUNK_SIZE, rawData.length);
      
      this.db.runInTransaction(() => {
        for (let j = i; j < end; j++) {
          const row = rawData[j];
          if (!row) continue;

          const sourceText = row[options.sourceCol] !== undefined ? String(row[options.sourceCol]).trim() : '';
          const targetText = row[options.targetCol] !== undefined ? String(row[options.targetCol]).trim() : '';

          if (!sourceText || !targetText) {
            skipped++;
            continue;
          }

          const sourceTokens = parseDisplayTextToTokens(sourceText);
          const targetTokens = parseDisplayTextToTokens(targetText);
          const tagsSignature = computeTagsSignature(sourceTokens);
          const matchKey = computeMatchKey(sourceTokens);
          const srcHash = computeSrcHash(matchKey, tagsSignature);

          const existing = this.db.findTMEntryByHash(tmId, srcHash);
          if (existing && !options.overwrite) {
            skipped++;
            continue;
          }

          this.db.upsertTMEntry({
            id: existing ? existing.id : randomUUID(),
            tmId,
            projectId: 0,
            srcLang: tm.srcLang,
            tgtLang: tm.tgtLang,
            srcHash,
            matchKey,
            tagsSignature,
            sourceTokens,
            targetTokens,
            usageCount: existing ? existing.usageCount + 1 : 1,
            createdAt: existing ? existing.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          success++;
        }
      });

      this.emitProgress('tm-import', end - startIndex, totalRows, `Imported ${end - startIndex} of ${totalRows} rows...`);
      // Small delay to let the event loop breathe and allow IPC messages to be sent
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return { success, skipped };
  }

  public async commitToMainTM(tmId: string, fileId: number) {
    const tm = this.db.getTM(tmId);
    if (!tm) throw new Error('Target TM not found');

    const segments = this.db.getSegmentsPage(fileId, 0, 1000000);
    const confirmedSegments = segments.filter(s => s.status === 'confirmed');
    
    for (const seg of confirmedSegments) {
      this.db.upsertTMEntry({
        id: randomUUID(),
        tmId,
        projectId: 0, // Not strictly used in v5 schema for lookups
        srcLang: tm.srcLang,
        tgtLang: tm.tgtLang,
        srcHash: seg.srcHash,
        matchKey: seg.matchKey,
        tagsSignature: seg.tagsSignature,
        sourceTokens: seg.sourceTokens,
        targetTokens: seg.targetTokens,
        originSegmentId: seg.segmentId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 1
      });
    }
    return confirmedSegments.length;
  }

  public async exportFile(fileId: number, outputPath: string, options?: ImportOptions, forceExport: boolean = false) {
    const file = this.db.getFile(fileId);
    if (!file) throw new Error('File not found');
    
    const project = this.db.getProject(file.projectId);
    if (!project) throw new Error('Project not found');

    // Use provided options or stored options
    const finalOptions = options || (file.importOptionsJson ? JSON.parse(file.importOptionsJson) : null);
    if (!finalOptions) {
      throw new Error('Export options not found for this file. Please specify columns.');
    }

    const segments = this.db.getSegmentsPage(fileId, 0, 1000000);
    
    // QA Check before export
    const errors: { row: number, message: string }[] = [];
    for (const seg of segments) {
      const issues = validateSegmentTags(seg);
      const criticalErrors = issues.filter(i => i.severity === 'error');
      if (criticalErrors.length > 0) {
        errors.push({
          row: seg.meta.rowRef || 0,
          message: criticalErrors.map(e => e.message).join('; ')
        });
      }
    }

    if (errors.length > 0 && !forceExport) {
      const errorMsg = errors.slice(0, 5).map(e => `Row ${e.row}: ${e.message}`).join('\n');
      const error = new Error(`Export blocked by QA errors:\n${errorMsg}${errors.length > 5 ? `\n...and ${errors.length - 5} more.` : ''}`);
      (error as any).qaErrors = errors; // Attach full error list for UI to display
      throw error;
    }

    const storedPath = join(this.projectsDir, file.projectId.toString(), `${file.id}_${file.name}`);
    await this.filter.export(storedPath, segments, finalOptions, outputPath);
  }
}
