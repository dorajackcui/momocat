import {
  DEFAULT_PROJECT_AI_MODEL,
  Project,
  ProjectAIModel,
  ProjectType,
  Segment,
  SegmentStatus,
  Token,
  TagValidator,
  isProjectAIModel,
  parseEditorTextToTokens,
  serializeTokensToDisplayText,
  serializeTokensToEditorText,
} from '@cat/core';
import type {
  AIBatchMode,
  AIBatchTargetScope,
  ProxySettings,
  ProxySettingsInput,
} from '../../../shared/ipc';
import { AITransport, ProjectRepository, SegmentRepository, SettingsRepository } from '../ports';
import { ProxySettingsApplier, ProxySettingsManager } from '../proxy/ProxySettingsManager';
import { SegmentService } from '../SegmentService';
import {
  buildAISystemPrompt,
  buildAIUserPrompt,
  getAIProgressVerb,
  normalizeProjectType,
} from './ai-prompts';
import type { PromptTBReference, PromptTMReference } from './ai-prompts/types';
import { buildDialogueUnits, translateDialogueUnit } from './ai/dialogueTranslation';
import { resolveTranslationPromptReferences } from './ai/promptReferences';
import type { PromptReferenceResolvers, TranslationPromptReferences } from './ai/types';

interface TranslateDebugMeta {
  requestId?: string;
  status?: number;
  endpoint?: string;
  model?: string;
  rawResponseText?: string;
  responseContent?: string;
}

export class AIModule {
  private static readonly SEGMENT_PAGE_SIZE = 1000;
  private static readonly AI_API_KEY = 'openai_api_key';
  private static readonly PROXY_MODE_KEY = 'app_proxy_mode';
  private static readonly PROXY_URL_KEY = 'app_proxy_url';
  private static readonly DIALOGUE_MAX_SEGMENTS_PER_UNIT = 6;
  private static readonly DIALOGUE_MAX_CHARS_PER_UNIT = 1200;
  private static readonly TRANSLATION_INTERVAL_MS = 40;
  private readonly tagValidator = new TagValidator();
  private readonly segmentAIOperationLocks = new Set<string>();

  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly segmentRepo: SegmentRepository,
    private readonly settingsRepo: SettingsRepository,
    private readonly segmentService: SegmentService,
    private readonly transport: AITransport,
    private readonly proxySettingsManager: ProxySettingsApplier = new ProxySettingsManager(),
    private readonly promptReferenceResolvers: PromptReferenceResolvers = {},
  ) {}

  public getAISettings(): { apiKeySet: boolean; apiKeyLast4?: string } {
    const apiKey = this.settingsRepo.getSetting(AIModule.AI_API_KEY);
    if (!apiKey) {
      return { apiKeySet: false };
    }
    return { apiKeySet: true, apiKeyLast4: apiKey.slice(-4) };
  }

  public setAIKey(apiKey: string) {
    this.settingsRepo.setSetting(AIModule.AI_API_KEY, apiKey);
  }

  public clearAIKey() {
    this.settingsRepo.setSetting(AIModule.AI_API_KEY, null);
  }

  public getProxySettings(): ProxySettings {
    return {
      mode: this.readProxyMode(),
      customProxyUrl: this.readStoredProxyUrl(),
      effectiveProxyUrl: this.proxySettingsManager.getEffectiveProxyUrl(),
    };
  }

  public setProxySettings(settings: ProxySettingsInput): ProxySettings {
    const mode = settings.mode;
    const customProxyUrl = settings.customProxyUrl?.trim() ?? this.readStoredProxyUrl();
    const applied = this.proxySettingsManager.applySettings({ mode, customProxyUrl });

    this.settingsRepo.setSetting(AIModule.PROXY_MODE_KEY, applied.mode);
    this.settingsRepo.setSetting(AIModule.PROXY_URL_KEY, applied.customProxyUrl || null);

    return {
      ...applied,
      effectiveProxyUrl: this.proxySettingsManager.getEffectiveProxyUrl(),
    };
  }

  public applySavedProxySettings(): ProxySettings {
    const mode = this.readProxyMode();
    const customProxyUrl = this.readStoredProxyUrl();
    const applied = this.proxySettingsManager.applySettings({ mode, customProxyUrl });

    return {
      ...applied,
      customProxyUrl,
      effectiveProxyUrl: this.proxySettingsManager.getEffectiveProxyUrl(),
    };
  }

  public async testAIConnection(apiKey?: string) {
    const key = (apiKey && apiKey.trim()) || this.settingsRepo.getSetting(AIModule.AI_API_KEY);
    if (!key) {
      throw new Error('API key is not set');
    }
    return this.transport.testConnection(key);
  }

  public async aiTranslateFile(
    fileId: number,
    options?: {
      model?: string;
      mode?: AIBatchMode;
      targetScope?: AIBatchTargetScope;
      onProgress?: (data: { current: number; total: number; message?: string }) => void;
    },
  ) {
    const file = this.projectRepo.getFile(fileId);
    if (!file) throw new Error('File not found');

    const project = this.projectRepo.getProject(file.projectId);
    if (!project) throw new Error('Project not found');

    const apiKey = this.settingsRepo.getSetting(AIModule.AI_API_KEY);
    if (!apiKey) {
      throw new Error('AI API key is not configured');
    }

    const model = this.resolveModel(options?.model, project.aiModel);
    const projectType = project.projectType || 'translation';
    const temperature = this.resolveTemperature(project.aiTemperature);
    const targetScope = this.resolveBatchTargetScope(options?.targetScope);
    if (projectType === 'translation' && options?.mode === 'dialogue') {
      return this.aiTranslateFileByDialogueUnits({
        fileId,
        project,
        apiKey,
        model,
        temperature,
        targetScope,
        onProgress: options?.onProgress,
      });
    }

    const totalSegments = this.countFileSegments(fileId);
    const total = this.countTranslatableSegments(fileId, targetScope);
    let current = 0;
    let translated = 0;
    const skipped = totalSegments - total;
    let failed = 0;
    const aiStatus: SegmentStatus = projectType === 'review' ? 'reviewed' : 'translated';

    for (const seg of this.iterateFileSegments(fileId)) {
      if (!this.isTranslatableSegment(seg, targetScope)) continue;

      current += 1;
      options?.onProgress?.({
        current,
        total,
        message: `${getAIProgressVerb(projectType)} segment ${current} of ${total}`,
      });

      try {
        const targetTokens = await this.translateBatchSegment({
          projectId: file.projectId,
          segment: seg,
          apiKey,
          model,
          projectPrompt: project.aiPrompt || '',
          projectType,
          temperature,
          srcLang: project.srcLang,
          tgtLang: project.tgtLang,
        });

        await this.segmentService.updateSegment(seg.segmentId, targetTokens, aiStatus);
        translated += 1;
      } catch {
        failed += 1;
      }

      await this.sleep(AIModule.TRANSLATION_INTERVAL_MS);
    }

    return { translated, skipped, failed, total: totalSegments };
  }

  public async aiTranslateSegment(
    segmentId: string,
    options?: {
      model?: string;
    },
  ): Promise<{ segmentId: string; status: SegmentStatus }> {
    return this.withSegmentAIOperationLock(segmentId, async () => {
      const segment = this.segmentRepo.getSegment(segmentId);
      if (!segment) throw new Error('Segment not found');

      const file = this.projectRepo.getFile(segment.fileId);
      if (!file) throw new Error('File not found');

      const project = this.projectRepo.getProject(file.projectId);
      if (!project) throw new Error('Project not found');

      const apiKey = this.settingsRepo.getSetting(AIModule.AI_API_KEY);
      if (!apiKey) {
        throw new Error('AI API key is not configured');
      }

      const sourceText = serializeTokensToDisplayText(segment.sourceTokens);
      if (!sourceText.trim()) {
        throw new Error('Source segment is empty');
      }

      const sourceTagPreservedText = serializeTokensToEditorText(
        segment.sourceTokens,
        segment.sourceTokens,
      );
      const context = segment.meta?.context ? String(segment.meta.context).trim() : '';
      const projectType = project.projectType || 'translation';
      const aiStatus: SegmentStatus = projectType === 'review' ? 'reviewed' : 'translated';
      const model = this.resolveModel(options?.model, project.aiModel);
      const temperature = this.resolveTemperature(project.aiTemperature);
      const promptReferences =
        projectType === 'translation'
          ? await this.resolveTranslationPromptReferences(file.projectId, segment)
          : {};

      const targetTokens = await this.translateSegment({
        apiKey,
        model,
        projectPrompt: project.aiPrompt || '',
        projectType,
        temperature,
        srcLang: project.srcLang,
        tgtLang: project.tgtLang,
        sourceTokens: segment.sourceTokens,
        sourceText,
        sourceTagPreservedText,
        context,
        tmReference: promptReferences.tmReference,
        tbReferences: promptReferences.tbReferences,
      });

      await this.segmentService.updateSegment(segment.segmentId, targetTokens, aiStatus);

      return { segmentId: segment.segmentId, status: aiStatus };
    });
  }

  public async aiRefineSegment(
    segmentId: string,
    instruction: string,
    options?: {
      model?: string;
    },
  ): Promise<{ segmentId: string; status: SegmentStatus }> {
    return this.withSegmentAIOperationLock(segmentId, async () => {
      const segment = this.segmentRepo.getSegment(segmentId);
      if (!segment) throw new Error('Segment not found');

      const file = this.projectRepo.getFile(segment.fileId);
      if (!file) throw new Error('File not found');

      const project = this.projectRepo.getProject(file.projectId);
      if (!project) throw new Error('Project not found');

      const apiKey = this.settingsRepo.getSetting(AIModule.AI_API_KEY);
      if (!apiKey) {
        throw new Error('AI API key is not configured');
      }

      const refinementInstruction = instruction.trim();
      if (!refinementInstruction) {
        throw new Error('Refinement instruction is empty');
      }

      const sourceText = serializeTokensToDisplayText(segment.sourceTokens);
      if (!sourceText.trim()) {
        throw new Error('Source segment is empty');
      }

      const currentTranslationText = serializeTokensToDisplayText(segment.targetTokens);
      if (!currentTranslationText.trim()) {
        throw new Error('Target segment is empty');
      }

      const sourceTagPreservedText = serializeTokensToEditorText(
        segment.sourceTokens,
        segment.sourceTokens,
      );
      const currentTranslationTagPreservedText = serializeTokensToEditorText(
        segment.targetTokens,
        segment.sourceTokens,
      );
      const context = segment.meta?.context ? String(segment.meta.context).trim() : '';
      const projectType = project.projectType || 'translation';
      const aiStatus: SegmentStatus = projectType === 'review' ? 'reviewed' : 'translated';
      const model = this.resolveModel(options?.model, project.aiModel);
      const temperature = this.resolveTemperature(project.aiTemperature);
      const promptReferences =
        projectType === 'translation'
          ? await this.resolveTranslationPromptReferences(file.projectId, segment)
          : {};

      const targetTokens = await this.translateSegment({
        apiKey,
        model,
        projectPrompt: project.aiPrompt || '',
        projectType,
        temperature,
        srcLang: project.srcLang,
        tgtLang: project.tgtLang,
        sourceTokens: segment.sourceTokens,
        sourceText,
        sourceTagPreservedText,
        context,
        currentTranslationPayload: currentTranslationTagPreservedText,
        refinementInstruction,
        tmReference: promptReferences.tmReference,
        tbReferences: promptReferences.tbReferences,
      });

      await this.segmentService.updateSegment(segment.segmentId, targetTokens, aiStatus);

      return { segmentId: segment.segmentId, status: aiStatus };
    });
  }

  public async aiTestTranslate(projectId: number, sourceText: string, contextText?: string) {
    const project = this.projectRepo.getProject(projectId);
    if (!project) throw new Error('Project not found');

    const apiKey = this.settingsRepo.getSetting(AIModule.AI_API_KEY);
    if (!apiKey) {
      throw new Error('AI API key is not configured');
    }

    const model = this.resolveModel(project.aiModel);
    const temperature = this.resolveTemperature(project.aiTemperature);
    const source = sourceText.trim();
    const context = contextText?.trim() ?? '';
    const promptUsed = buildAISystemPrompt(project.projectType || 'translation', {
      srcLang: project.srcLang,
      tgtLang: project.tgtLang,
      projectPrompt: project.aiPrompt || '',
    });
    const userMessage = buildAIUserPrompt(normalizeProjectType(project.projectType), {
      srcLang: project.srcLang,
      sourcePayload: source,
      hasProtectedMarkers: false,
      context,
    });
    const debug: TranslateDebugMeta = {};

    try {
      const translatedText = await this.translateText({
        apiKey,
        model,
        projectPrompt: project.aiPrompt || '',
        projectType: project.projectType || 'translation',
        temperature,
        srcLang: project.srcLang,
        tgtLang: project.tgtLang,
        sourceText: source,
        context,
        debug,
        allowUnchanged: true,
      });

      const unchanged =
        translatedText.trim() === source &&
        project.srcLang !== project.tgtLang &&
        project.projectType !== 'review' &&
        project.projectType !== 'custom';
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
        responseContent: debug.responseContent,
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
        responseContent: debug.responseContent,
      };
    }
  }

  private async aiTranslateFileByDialogueUnits(params: {
    fileId: number;
    project: Project;
    apiKey: string;
    model: string;
    temperature: number;
    targetScope: AIBatchTargetScope;
    onProgress?: (data: { current: number; total: number; message?: string }) => void;
  }) {
    const units = buildDialogueUnits({
      segments: this.iterateFileSegments(params.fileId),
      isTranslatableSegment: (segment) => this.isTranslatableSegment(segment, params.targetScope),
      maxSegmentsPerUnit: AIModule.DIALOGUE_MAX_SEGMENTS_PER_UNIT,
      maxCharsPerUnit: AIModule.DIALOGUE_MAX_CHARS_PER_UNIT,
    });
    const totalSegments = this.countFileSegments(params.fileId);
    const total = units.reduce((sum, unit) => sum + unit.segments.length, 0);
    const skipped = totalSegments - total;
    let current = 0;
    let translated = 0;
    let failed = 0;
    let previousGroup: { speaker: string; sourceText: string; targetText: string } | undefined;

    for (const unit of units) {
      try {
        const result = await translateDialogueUnit({
          projectId: params.project.id,
          project: params.project,
          apiKey: params.apiKey,
          model: params.model,
          temperature: params.temperature,
          unit,
          previousGroup,
          transport: this.transport,
          tagValidator: this.tagValidator,
          resolveTranslationPromptReferences: (projectId, segment) =>
            this.resolveTranslationPromptReferences(projectId, segment),
        });

        await this.segmentService.updateSegmentsAtomically(result.updates);
        translated += unit.segments.length;
        previousGroup = result.previousGroup;
        for (let index = 0; index < unit.segments.length; index += 1) {
          current += 1;
          params.onProgress?.({
            current,
            total,
            message: `${getAIProgressVerb('translation')} segment ${current} of ${total}`,
          });
        }
      } catch {
        for (const draft of unit.segments) {
          try {
            const targetTokens = await this.translateBatchSegment({
              projectId: params.project.id,
              segment: draft.segment,
              apiKey: params.apiKey,
              model: params.model,
              projectPrompt: params.project.aiPrompt || '',
              projectType: 'translation',
              temperature: params.temperature,
              srcLang: params.project.srcLang,
              tgtLang: params.project.tgtLang,
            });

            await this.segmentService.updateSegment(
              draft.segment.segmentId,
              targetTokens,
              'translated',
            );
            translated += 1;
            previousGroup = {
              speaker: draft.speaker || 'Unknown',
              sourceText: draft.sourcePayload,
              targetText: serializeTokensToEditorText(targetTokens, draft.segment.sourceTokens),
            };
          } catch {
            failed += 1;
          }
          current += 1;
          params.onProgress?.({
            current,
            total,
            message: `${getAIProgressVerb('translation')} segment ${current} of ${total}`,
          });

          await this.sleep(AIModule.TRANSLATION_INTERVAL_MS);
        }

        continue;
      }

      await this.sleep(AIModule.TRANSLATION_INTERVAL_MS);
    }

    return { translated, skipped, failed, total: totalSegments };
  }

  private async translateBatchSegment(params: {
    projectId: number;
    segment: Segment;
    apiKey: string;
    model: string;
    projectPrompt: string;
    projectType: ProjectType;
    temperature: number;
    srcLang: string;
    tgtLang: string;
  }): Promise<Token[]> {
    const sourceText = serializeTokensToDisplayText(params.segment.sourceTokens);
    const sourceTagPreservedText = serializeTokensToEditorText(
      params.segment.sourceTokens,
      params.segment.sourceTokens,
    );
    const context = params.segment.meta?.context ? String(params.segment.meta.context).trim() : '';
    const promptReferences =
      params.projectType === 'translation'
        ? await this.resolveTranslationPromptReferences(params.projectId, params.segment)
        : {};

    return this.translateSegment({
      apiKey: params.apiKey,
      model: params.model,
      projectPrompt: params.projectPrompt,
      projectType: params.projectType,
      temperature: params.temperature,
      srcLang: params.srcLang,
      tgtLang: params.tgtLang,
      sourceTokens: params.segment.sourceTokens,
      sourceText,
      sourceTagPreservedText,
      context,
      tmReference: promptReferences.tmReference,
      tbReferences: promptReferences.tbReferences,
    });
  }

  private async translateSegment(params: {
    apiKey: string;
    model: string;
    projectPrompt?: string;
    projectType?: ProjectType;
    temperature?: number;
    srcLang: string;
    tgtLang: string;
    sourceTokens: Token[];
    sourceText: string;
    sourceTagPreservedText: string;
    context?: string;
    currentTranslationPayload?: string;
    refinementInstruction?: string;
    tmReference?: PromptTMReference;
    tbReferences?: PromptTBReference[];
  }): Promise<Token[]> {
    const maxAttempts = 3;
    let validationFeedback: string | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const normalizedType = normalizeProjectType(params.projectType);
      const translatedText = await this.translateText({
        apiKey: params.apiKey,
        model: params.model,
        projectPrompt: params.projectPrompt,
        projectType: normalizedType,
        temperature: params.temperature,
        srcLang: params.srcLang,
        tgtLang: params.tgtLang,
        sourceText: params.sourceText,
        sourceTagPreservedText: params.sourceTagPreservedText,
        context: params.context,
        currentTranslationPayload: params.currentTranslationPayload,
        refinementInstruction: params.refinementInstruction,
        tmReference: params.tmReference,
        tbReferences: params.tbReferences,
        validationFeedback,
        allowUnchanged: normalizedType === 'review' || normalizedType === 'custom',
      });

      const targetTokens = parseEditorTextToTokens(translatedText, params.sourceTokens);
      if (normalizedType === 'custom') {
        return targetTokens;
      }
      const validationResult = this.tagValidator.validate(params.sourceTokens, targetTokens);
      const errors = validationResult.issues.filter((issue) => issue.severity === 'error');

      if (errors.length === 0) {
        return targetTokens;
      }

      if (attempt === maxAttempts) {
        throw new Error(
          `Tag validation failed after ${maxAttempts} attempts: ${errors.map((e) => e.message).join('; ')}`,
        );
      }

      validationFeedback = [
        'Previous translation was invalid.',
        ...errors.map((e) => `- ${e.message}`),
        'Retry by preserving marker content and sequence exactly.',
      ].join('\n');
    }

    throw new Error('Unexpected translation retry failure');
  }

  private async translateText(params: {
    apiKey: string;
    model: string;
    projectPrompt?: string;
    projectType?: ProjectType;
    temperature?: number;
    srcLang: string;
    tgtLang: string;
    sourceText: string;
    sourceTagPreservedText?: string;
    context?: string;
    currentTranslationPayload?: string;
    refinementInstruction?: string;
    tmReference?: PromptTMReference;
    tbReferences?: PromptTBReference[];
    validationFeedback?: string;
    debug?: TranslateDebugMeta;
    allowUnchanged?: boolean;
  }): Promise<string> {
    const normalizedType = normalizeProjectType(params.projectType);
    const systemPrompt = buildAISystemPrompt(normalizedType, {
      srcLang: params.srcLang,
      tgtLang: params.tgtLang,
      projectPrompt: params.projectPrompt,
    });
    const hasProtectedMarkers =
      typeof params.sourceTagPreservedText === 'string' &&
      params.sourceTagPreservedText.length > 0 &&
      params.sourceTagPreservedText !== params.sourceText;
    const sourcePayload = hasProtectedMarkers ? params.sourceTagPreservedText! : params.sourceText;
    const userPrompt = buildAIUserPrompt(normalizedType, {
      srcLang: params.srcLang,
      sourcePayload,
      hasProtectedMarkers,
      context: params.context,
      currentTranslationPayload: params.currentTranslationPayload,
      refinementInstruction: params.refinementInstruction,
      tmReference: params.tmReference,
      tbReferences: params.tbReferences,
      validationFeedback: params.validationFeedback,
    });

    if (params.debug) {
      params.debug.model = params.model;
    }

    const response = await this.transport.chatCompletions({
      apiKey: params.apiKey,
      model: params.model,
      temperature: this.resolveTemperature(params.temperature),
      systemPrompt,
      userPrompt,
    });

    if (params.debug) {
      params.debug.requestId = response.requestId;
      params.debug.status = response.status;
      params.debug.endpoint = response.endpoint;
      params.debug.rawResponseText = response.rawResponseText;
      params.debug.responseContent = response.content;
    }

    const trimmed = response.content.trim();
    if (!trimmed) {
      throw new Error('OpenAI response was empty');
    }

    const unchangedAgainstSource = trimmed === params.sourceText.trim();
    const unchangedAgainstPayload = trimmed === sourcePayload.trim();
    const allowUnchanged =
      Boolean(params.allowUnchanged) || normalizedType === 'review' || normalizedType === 'custom';
    if (
      !allowUnchanged &&
      (unchangedAgainstSource || unchangedAgainstPayload) &&
      params.srcLang !== params.tgtLang
    ) {
      throw new Error(`Model returned source unchanged: ${trimmed}`);
    }

    return trimmed;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private resolveTemperature(value: number | null | undefined): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0.2;
    }

    return Math.max(0, Math.min(2, value));
  }

  private resolveModel(
    model?: string | null,
    projectModel?: ProjectAIModel | null,
  ): ProjectAIModel {
    if (isProjectAIModel(model)) {
      return model;
    }

    if (isProjectAIModel(projectModel)) {
      return projectModel;
    }

    return DEFAULT_PROJECT_AI_MODEL;
  }

  private readProxyMode(): ProxySettings['mode'] {
    const mode = this.settingsRepo.getSetting(AIModule.PROXY_MODE_KEY);
    if (mode === 'off' || mode === 'custom' || mode === 'system') {
      return mode;
    }
    return 'system';
  }

  private readStoredProxyUrl(): string {
    return this.settingsRepo.getSetting(AIModule.PROXY_URL_KEY)?.trim() ?? '';
  }

  private async resolveTranslationPromptReferences(
    projectId: number,
    segment: Segment,
  ): Promise<TranslationPromptReferences> {
    return resolveTranslationPromptReferences({
      projectId,
      segment,
      resolvers: this.promptReferenceResolvers,
    });
  }

  private async withSegmentAIOperationLock<T>(
    segmentId: string,
    task: () => Promise<T>,
  ): Promise<T> {
    if (this.segmentAIOperationLocks.has(segmentId)) {
      throw new Error('AI request already in progress for this segment');
    }
    this.segmentAIOperationLocks.add(segmentId);
    try {
      return await task();
    } finally {
      this.segmentAIOperationLocks.delete(segmentId);
    }
  }

  private resolveBatchTargetScope(scope?: AIBatchTargetScope): AIBatchTargetScope {
    return scope === 'overwrite-non-confirmed' ? scope : 'blank-only';
  }

  private isTranslatableSegment(segment: Segment, targetScope: AIBatchTargetScope): boolean {
    const sourceText = serializeTokensToDisplayText(segment.sourceTokens).trim();
    if (!sourceText) return false;
    if (segment.status === 'confirmed') return false;
    if (targetScope === 'overwrite-non-confirmed') return true;
    const existingTarget = serializeTokensToDisplayText(segment.targetTokens).trim();
    return existingTarget.length === 0;
  }

  private countFileSegments(fileId: number): number {
    let count = 0;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const page = this.segmentRepo.getSegmentsPage(fileId, offset, AIModule.SEGMENT_PAGE_SIZE);
      if (page.length === 0) {
        break;
      }
      count += page.length;
      hasMore = page.length === AIModule.SEGMENT_PAGE_SIZE;
      offset += AIModule.SEGMENT_PAGE_SIZE;
    }

    return count;
  }

  private countTranslatableSegments(fileId: number, targetScope: AIBatchTargetScope): number {
    let count = 0;
    for (const segment of this.iterateFileSegments(fileId)) {
      if (this.isTranslatableSegment(segment, targetScope)) {
        count += 1;
      }
    }
    return count;
  }

  private *iterateFileSegments(fileId: number): Generator<Segment> {
    let offset = 0;

    while (true) {
      const page = this.segmentRepo.getSegmentsPage(fileId, offset, AIModule.SEGMENT_PAGE_SIZE);
      if (page.length === 0) return;
      for (const segment of page) {
        yield segment;
      }
      if (page.length < AIModule.SEGMENT_PAGE_SIZE) return;
      offset += AIModule.SEGMENT_PAGE_SIZE;
    }
  }
}
