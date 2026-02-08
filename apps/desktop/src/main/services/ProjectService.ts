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
  parseEditorTextToTokens,
  serializeTokensToDisplayText,
  serializeTokensToEditorText,
  computeTagsSignature,
  computeMatchKey,
  computeSrcHash,
  TagValidator
} from '@cat/core';
import { join, basename } from 'path';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, unlinkSync } from 'fs';
import { randomUUID } from 'crypto';
import { Worker } from 'worker_threads';
import * as XLSX from 'xlsx';
import { TMService } from './TMService';
import { SegmentService } from './SegmentService';

export class ProjectService {
  private db: CATDatabase;
  private filter: SpreadsheetFilter;
  private projectsDir: string;
  private dbPath: string;
  private tmService: TMService;
  private segmentService: SegmentService;
  private tagValidator: TagValidator;
  private progressCallbacks: ((data: { type: string; current: number; total: number; message?: string }) => void)[] = [];

  constructor(db: CATDatabase, projectsDir: string, dbPath: string) {
    this.db = db;
    this.filter = new SpreadsheetFilter();
    this.projectsDir = projectsDir;
    this.dbPath = dbPath;
    this.tmService = new TMService(this.db);
    this.segmentService = new SegmentService(this.db, this.tmService);
    this.tagValidator = new TagValidator();

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

  public updateProjectPrompt(projectId: number, aiPrompt: string | null) {
    return this.db.updateProjectPrompt(projectId, aiPrompt);
  }

  public updateProjectAISettings(projectId: number, aiPrompt: string | null, aiTemperature: number | null) {
    return this.db.updateProjectAISettings(projectId, aiPrompt, aiTemperature);
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
    try {
      return await this.importTMEntriesInWorker(tmId, filePath, options);
    } catch (error) {
      console.error('[ProjectService] TM import worker failed, falling back to main thread:', error);
      return this.importTMEntriesInMainThread(tmId, filePath, options);
    }
  }

  private async importTMEntriesInWorker(
    tmId: string,
    filePath: string,
    options: { sourceCol: number; targetCol: number; hasHeader: boolean; overwrite: boolean }
  ): Promise<{ success: number; skipped: number }> {
    const workerPath = join(__dirname, 'tmImportWorker.js');

    return new Promise((resolve, reject) => {
      const worker = new Worker(workerPath, {
        workerData: {
          dbPath: this.dbPath,
          tmId,
          filePath,
          options
        }
      });
      let settled = false;

      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      worker.on('message', (message: any) => {
        if (!message || typeof message !== 'object') return;

        if (message.type === 'progress') {
          this.emitProgress(
            'tm-import',
            Number(message.current) || 0,
            Number(message.total) || 0,
            typeof message.message === 'string' ? message.message : undefined
          );
          return;
        }

        if (message.type === 'done') {
          if (settled) return;
          settled = true;
          resolve(message.result ?? { success: 0, skipped: 0 });
          return;
        }

        if (message.type === 'error') {
          fail(new Error(message.error || 'TM import worker failed'));
        }
      });

      worker.on('error', fail);
      worker.on('exit', (code) => {
        if (settled) return;
        if (code === 0) {
          fail(new Error('TM import worker exited without returning result'));
          return;
        }
        fail(new Error(`TM import worker exited with code ${code}`));
      });
    });
  }

  private async importTMEntriesInMainThread(
    tmId: string, 
    filePath: string, 
    options: { sourceCol: number; targetCol: number; hasHeader: boolean; overwrite: boolean }
  ): Promise<{ success: number; skipped: number }> {
    const tm = this.db.getTM(tmId);
    if (!tm) throw new Error('Target TM not found');

    // Surface immediate feedback before heavy XLSX parsing starts.
    this.emitProgress('tm-import', 0, 1, 'Reading spreadsheet...');

    const workbook = XLSX.read(readFileSync(filePath), { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    const startIndex = options.hasHeader ? 1 : 0;
    const totalRows = Math.max(rawData.length - startIndex, 0);
    let success = 0;
    let skipped = 0;

    if (totalRows === 0) {
      return { success, skipped };
    }

    // Keep chunks moderate to balance throughput and UI responsiveness.
    const CHUNK_SIZE = totalRows >= 100000 ? 1500 : 800;

    // Emit immediately so UI switches to progress mode right away.
    this.emitProgress('tm-import', 0, totalRows, 'Preparing import...');

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

          const now = new Date().toISOString();
          const entryBase = {
            id: randomUUID(),
            tmId,
            projectId: 0,
            srcLang: tm.srcLang,
            tgtLang: tm.tgtLang,
            srcHash,
            matchKey,
            tagsSignature,
            sourceTokens,
            targetTokens,
            usageCount: 1,
            createdAt: now,
            updatedAt: now
          };

          if (options.overwrite) {
            const entryId = this.db.upsertTMEntryBySrcHash(entryBase);
            this.db.replaceTMFts(tmId, sourceText, targetText, entryId);
            success++;
            continue;
          }

          const insertedId = this.db.insertTMEntryIfAbsentBySrcHash(entryBase);
          if (!insertedId) {
            skipped++;
            continue;
          }

          this.db.insertTMFts(tmId, sourceText, targetText, insertedId);
          success++;
        }
      });

      const processedRows = end - startIndex;
      // Emit once per chunk for responsive progress feedback with low overhead.
      this.emitProgress('tm-import', processedRows, totalRows, `Imported ${processedRows} of ${totalRows} rows...`);

      // Yield every chunk so UI and IPC stay responsive.
      await new Promise<void>(resolve => setImmediate(resolve));
    }

    return { success, skipped };
  }

  public async commitToMainTM(tmId: string, fileId: number) {
    const tm = this.db.getTM(tmId);
    if (!tm) throw new Error('Target TM not found');

    const segments = this.db.getSegmentsPage(fileId, 0, 1000000);
    const confirmedSegments = segments.filter(s => s.status === 'confirmed');
    
    for (const seg of confirmedSegments) {
      const entryId = this.db.upsertTMEntryBySrcHash({
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
      this.db.replaceTMFts(
        tmId,
        serializeTokensToDisplayText(seg.sourceTokens),
        serializeTokensToDisplayText(seg.targetTokens),
        entryId
      );
    }
    return confirmedSegments.length;
  }

  public async batchMatchFileWithTM(
    fileId: number,
    tmId: string
  ): Promise<{ total: number; matched: number; applied: number; skipped: number }> {
    const file = this.db.getFile(fileId);
    if (!file) throw new Error('File not found');

    const tm = this.db.getTM(tmId);
    if (!tm) throw new Error('TM not found');

    const segments = this.db.getSegmentsPage(fileId, 0, 1000000);
    let matched = 0;
    let applied = 0;
    let skipped = 0;

    for (const seg of segments) {
      const match = this.db.findTMEntryByHash(tmId, seg.srcHash);
      if (!match) continue;

      matched += 1;

      if (seg.status === 'confirmed') {
        skipped += 1;
        continue;
      }

      this.db.updateSegmentTarget(seg.segmentId, match.targetTokens, 'confirmed');
      applied += 1;
    }

    return {
      total: segments.length,
      matched,
      applied,
      skipped
    };
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

  // AI Settings
  public getAISettings(): { apiKeySet: boolean; apiKeyLast4?: string } {
    const apiKey = this.db.getSetting('openai_api_key');
    if (!apiKey) {
      return { apiKeySet: false };
    }
    const last4 = apiKey.slice(-4);
    return { apiKeySet: true, apiKeyLast4: last4 };
  }

  public setAIKey(apiKey: string) {
    this.db.setSetting('openai_api_key', apiKey);
  }

  public clearAIKey() {
    this.db.setSetting('openai_api_key', null);
  }

  public async testAIConnection(apiKey?: string) {
    const key = (apiKey && apiKey.trim()) || this.db.getSetting('openai_api_key');
    if (!key) {
      throw new Error('API key is not set');
    }

    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${key}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Connection failed: ${response.status} ${errorText}`);
    }

    return { ok: true };
  }

  public async aiTranslateFile(
    fileId: number,
    options?: {
      model?: string;
      onProgress?: (data: { current: number; total: number; message?: string }) => void;
    }
  ) {
    const file = this.db.getFile(fileId);
    if (!file) throw new Error('File not found');

    const project = this.db.getProject(file.projectId);
    if (!project) throw new Error('Project not found');

    const apiKey = this.db.getSetting('openai_api_key');
    if (!apiKey) {
      throw new Error('AI API key is not configured');
    }

    const model = options?.model || 'gpt-4o-mini';
    const temperature = this.resolveTemperature(project.aiTemperature);
    const segments = this.db.getSegmentsPage(fileId, 0, 1000000);

    const segmentsToTranslate: typeof segments = [];
    let emptySourceStreak = 0;

    for (const seg of segments) {
      const sourceText = serializeTokensToDisplayText(seg.sourceTokens).trim();
      if (!sourceText) {
        emptySourceStreak += 1;
        if (emptySourceStreak >= 3) {
          break;
        }
        continue;
      }

      emptySourceStreak = 0;

      if (seg.status === 'confirmed') continue;
      const existing = serializeTokensToDisplayText(seg.targetTokens).trim();
      if (existing.length > 0) continue;

      segmentsToTranslate.push(seg);
    }

    const total = segmentsToTranslate.length;
    let current = 0;
    let translated = 0;
    let skipped = segments.length - total;
    let failed = 0;

    for (const seg of segmentsToTranslate) {
      current += 1;
      options?.onProgress?.({
        current,
        total,
        message: `Translating segment ${current} of ${total}`
      });

      const sourceText = serializeTokensToDisplayText(seg.sourceTokens);
      const sourceTagPreservedText = serializeTokensToEditorText(seg.sourceTokens, seg.sourceTokens);
      const context = seg.meta?.context ? String(seg.meta.context).trim() : '';
      try {
        const targetTokens = await this.translateSegmentWithOpenAI({
          apiKey,
          model,
          projectPrompt: project.aiPrompt || '',
          temperature,
          srcLang: project.srcLang,
          tgtLang: project.tgtLang,
          sourceTokens: seg.sourceTokens,
          sourceText,
          sourceTagPreservedText,
          context
        });
        await this.segmentService.updateSegment(seg.segmentId, targetTokens, 'translated');
        translated += 1;
      } catch (error) {
        failed += 1;
      }

      // brief pause to avoid hammering the API
      await new Promise(resolve => setTimeout(resolve, 40));
    }

    return { translated, skipped, failed, total: segments.length };
  }

  public async aiTestTranslate(projectId: number, sourceText: string) {
    const project = this.db.getProject(projectId);
    if (!project) throw new Error('Project not found');

    const apiKey = this.db.getSetting('openai_api_key');
    if (!apiKey) {
      throw new Error('AI API key is not configured');
    }

    const model = 'gpt-4o-mini';
    const temperature = this.resolveTemperature(project.aiTemperature);
    const source = sourceText.trim();
    const promptUsed = this.buildSystemPrompt(project.srcLang, project.tgtLang, project.aiPrompt || '');
    const userMessage = [`Source (${project.srcLang}):`, source].join('\n');
    const debug: {
      requestId?: string;
      status?: number;
      endpoint?: string;
      model?: string;
      rawResponseText?: string;
      responseContent?: string;
    } = {};

    try {
      const translatedText = await this.translateWithOpenAI({
        apiKey,
        model,
        projectPrompt: project.aiPrompt || '',
        temperature,
        srcLang: project.srcLang,
        tgtLang: project.tgtLang,
        sourceText: source,
        debug,
        allowUnchanged: true
      });

      const unchanged = translatedText.trim() === source && project.srcLang !== project.tgtLang;
      return {
        ok: !unchanged,
        error: unchanged ? `Model returned source unchanged: ${translatedText}` : undefined,
        promptUsed,
        userMessage,
        translatedText,
        requestId: debug.requestId,
        status: debug.status,
        endpoint: debug.endpoint,
        model: debug.model,
        rawResponseText: debug.rawResponseText,
        responseContent: debug.responseContent
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        error: message,
        promptUsed,
        userMessage,
        translatedText: '',
        requestId: debug.requestId,
        status: debug.status,
        endpoint: debug.endpoint,
        model: debug.model,
        rawResponseText: debug.rawResponseText,
        responseContent: debug.responseContent
      };
    }
  }

  private buildSystemPrompt(srcLang: string, tgtLang: string, projectPrompt?: string) {
    const base = [
      
      `Translate from ${srcLang} to ${tgtLang}.`,
      'The source can include protected markers such as {1>, <2}, {3}.',
      'Never translate, remove, reorder, renumber, or rewrite protected markers.',
      'Keep all tags, placeholders, and formatting exactly as they appear in the source.',
      'Return only the translated text, without quotes or extra commentary.',
      'Do not copy the source text unless it is already in the target language.'
    ].join('\n');

    const trimmed = projectPrompt?.trim();
    if (!trimmed) return `You are a professional translator.\n${base}`;
    return `${trimmed}\n${base}`;
  }

  private async translateSegmentWithOpenAI(params: {
    apiKey: string;
    model: string;
    projectPrompt?: string;
    temperature?: number;
    srcLang: string;
    tgtLang: string;
    sourceTokens: Token[];
    sourceText: string;
    sourceTagPreservedText: string;
    context?: string;
  }): Promise<Token[]> {
    const maxAttempts = 3;
    let validationFeedback: string | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const translatedText = await this.translateWithOpenAI({
        apiKey: params.apiKey,
        model: params.model,
        projectPrompt: params.projectPrompt,
        temperature: params.temperature,
        srcLang: params.srcLang,
        tgtLang: params.tgtLang,
        sourceText: params.sourceText,
        sourceTagPreservedText: params.sourceTagPreservedText,
        context: params.context,
        validationFeedback
      });

      const targetTokens = parseEditorTextToTokens(translatedText, params.sourceTokens);
      const validationResult = this.tagValidator.validate(params.sourceTokens, targetTokens);
      const errors = validationResult.issues.filter(issue => issue.severity === 'error');

      if (errors.length === 0) {
        return targetTokens;
      }

      if (attempt === maxAttempts) {
        throw new Error(`Tag validation failed after ${maxAttempts} attempts: ${errors.map(e => e.message).join('; ')}`);
      }

      validationFeedback = [
        'Previous translation was invalid.',
        ...errors.map(e => `- ${e.message}`),
        'Retry by preserving marker content and sequence exactly.'
      ].join('\n');
    }

    throw new Error('Unexpected translation retry failure');
  }

  private async translateWithOpenAI(params: {
    apiKey: string;
    model: string;
    projectPrompt?: string;
    temperature?: number;
    srcLang: string;
    tgtLang: string;
    sourceText: string;
    sourceTagPreservedText?: string;
    context?: string;
    validationFeedback?: string;
    debug?: {
      requestId?: string;
      status?: number;
      endpoint?: string;
      model?: string;
      rawResponseText?: string;
      responseContent?: string;
    };
    allowUnchanged?: boolean;
  }): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(params.srcLang, params.tgtLang, params.projectPrompt);
    const hasProtectedMarkers = typeof params.sourceTagPreservedText === 'string' && params.sourceTagPreservedText.length > 0;
    const sourcePayload = hasProtectedMarkers ? params.sourceTagPreservedText! : params.sourceText;
    const userParts = [
      hasProtectedMarkers
        ? `Source (${params.srcLang}, protected-marker format):`
        : `Source (${params.srcLang}):`,
      sourcePayload
    ];

    if (params.context) {
      userParts.push('', `Context: ${params.context}`);
    }

    if (params.validationFeedback) {
      userParts.push('', 'Validation feedback from previous attempt:', params.validationFeedback);
    }

    const endpoint = 'https://api.openai.com/v1/chat/completions';
    if (params.debug) {
      params.debug.endpoint = endpoint;
      params.debug.model = params.model;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`
      },
      body: JSON.stringify({
        model: params.model,
        temperature: this.resolveTemperature(params.temperature),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userParts.join('\n') }
        ]
      })
    });

    params.debug && (params.debug.status = response.status);
    const requestId = response.headers.get('x-request-id') || response.headers.get('x-openai-request-id');
    if (params.debug && requestId) params.debug.requestId = requestId;
    const rawBody = await response.text();
    if (params.debug) {
      params.debug.rawResponseText = rawBody.slice(0, 4000);
    }

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status} ${rawBody}`);
    }

    let data: any;
    try {
      data = JSON.parse(rawBody);
    } catch {
      throw new Error(`OpenAI response is not valid JSON: ${rawBody}`);
    }
    const content = data?.choices?.[0]?.message?.content;
    if (params.debug && typeof content === 'string') {
      params.debug.responseContent = content;
    }
    if (!content || typeof content !== 'string') {
      throw new Error('OpenAI response missing content');
    }

    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error('OpenAI response was empty');
    }

    const unchangedAgainstSource = trimmed === params.sourceText.trim();
    const unchangedAgainstPayload = trimmed === sourcePayload.trim();
    if (!params.allowUnchanged && (unchangedAgainstSource || unchangedAgainstPayload) && params.srcLang !== params.tgtLang) {
      throw new Error(`Model returned source unchanged: ${trimmed}`);
    }

    return trimmed;
  }

  private resolveTemperature(value: number | null | undefined): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0.2;
    }

    return Math.max(0, Math.min(2, value));
  }
}
