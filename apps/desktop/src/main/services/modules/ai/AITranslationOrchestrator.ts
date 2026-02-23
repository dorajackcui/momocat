import {
  Project,
  ProjectType,
  Segment,
  SegmentStatus,
  TagValidator,
  Token,
  serializeTokensToDisplayText,
  serializeTokensToEditorText,
} from '@cat/core';
import type { AIBatchMode, AIBatchTargetScope } from '../../../../shared/ipc';
import type { AITransport, ProjectRepository, SegmentRepository } from '../../ports';
import { SegmentService } from '../../SegmentService';
import { buildAIUserPrompt, buildAISystemPrompt, getAIProgressVerb, normalizeProjectType } from '../ai-prompts';
import { buildDialogueUnits, translateDialogueUnit } from './dialogueTranslation';
import { resolveTranslationPromptReferences } from './promptReferences';
import type { PromptReferenceResolvers, TranslationPromptReferences } from './types';
import { AISettingsService } from './AISettingsService';
import { AITextTranslator, TranslateDebugMeta } from './AITextTranslator';
import { SegmentPagingIterator } from './SegmentPagingIterator';

export interface AITranslateFileOptions {
  model?: string;
  mode?: AIBatchMode;
  targetScope?: AIBatchTargetScope;
  onProgress?: (data: { current: number; total: number; message?: string }) => void;
}

export class AITranslationOrchestrator {
  private static readonly DIALOGUE_MAX_SEGMENTS_PER_UNIT = 6;
  private static readonly DIALOGUE_MAX_CHARS_PER_UNIT = 1200;
  private static readonly TRANSLATION_INTERVAL_MS = 40;

  private readonly segmentAIOperationLocks = new Set<string>();
  private readonly tagValidator = new TagValidator();

  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly segmentRepo: SegmentRepository,
    private readonly segmentService: SegmentService,
    private readonly transport: AITransport,
    private readonly settingsService: AISettingsService,
    private readonly textTranslator: AITextTranslator,
    private readonly segmentPagingIterator: SegmentPagingIterator,
    private readonly promptReferenceResolvers: PromptReferenceResolvers = {},
  ) {}

  public async aiTranslateFile(
    fileId: number,
    options?: AITranslateFileOptions,
  ): Promise<{ translated: number; skipped: number; failed: number; total: number }> {
    const file = this.projectRepo.getFile(fileId);
    if (!file) throw new Error('File not found');

    const project = this.projectRepo.getProject(file.projectId);
    if (!project) throw new Error('Project not found');

    const apiKey = this.settingsService.getStoredApiKey();
    if (!apiKey) {
      throw new Error('AI API key is not configured');
    }

    const model = this.textTranslator.resolveModel(options?.model, project.aiModel);
    const projectType = project.projectType || 'translation';
    const temperature = this.textTranslator.resolveTemperature(project.aiTemperature);
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

    const totalSegments = this.segmentPagingIterator.countFileSegments(fileId);
    const total = this.segmentPagingIterator.countMatchingSegments(fileId, (segment) =>
      this.isTranslatableSegment(segment, targetScope),
    );
    let current = 0;
    let translated = 0;
    const skipped = totalSegments - total;
    let failed = 0;
    const aiStatus: SegmentStatus = projectType === 'review' ? 'reviewed' : 'translated';

    for (const seg of this.segmentPagingIterator.iterateFileSegments(fileId)) {
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

      await this.sleep(AITranslationOrchestrator.TRANSLATION_INTERVAL_MS);
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

      const apiKey = this.settingsService.getStoredApiKey();
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
      const model = this.textTranslator.resolveModel(options?.model, project.aiModel);
      const temperature = this.textTranslator.resolveTemperature(project.aiTemperature);
      const promptReferences =
        projectType === 'translation'
          ? await this.resolveTranslationPromptReferences(file.projectId, segment)
          : {};

      const targetTokens = await this.textTranslator.translateSegment({
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

      const apiKey = this.settingsService.getStoredApiKey();
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
      const model = this.textTranslator.resolveModel(options?.model, project.aiModel);
      const temperature = this.textTranslator.resolveTemperature(project.aiTemperature);
      const promptReferences =
        projectType === 'translation'
          ? await this.resolveTranslationPromptReferences(file.projectId, segment)
          : {};

      const targetTokens = await this.textTranslator.translateSegment({
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

    const apiKey = this.settingsService.getStoredApiKey();
    if (!apiKey) {
      throw new Error('AI API key is not configured');
    }

    const model = this.textTranslator.resolveModel(project.aiModel);
    const temperature = this.textTranslator.resolveTemperature(project.aiTemperature);
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
      const translatedText = await this.textTranslator.translateText({
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
      segments: this.segmentPagingIterator.iterateFileSegments(params.fileId),
      isTranslatableSegment: (segment) => this.isTranslatableSegment(segment, params.targetScope),
      maxSegmentsPerUnit: AITranslationOrchestrator.DIALOGUE_MAX_SEGMENTS_PER_UNIT,
      maxCharsPerUnit: AITranslationOrchestrator.DIALOGUE_MAX_CHARS_PER_UNIT,
    });
    const totalSegments = this.segmentPagingIterator.countFileSegments(params.fileId);
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

            await this.segmentService.updateSegment(draft.segment.segmentId, targetTokens, 'translated');
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

          await this.sleep(AITranslationOrchestrator.TRANSLATION_INTERVAL_MS);
        }

        continue;
      }

      await this.sleep(AITranslationOrchestrator.TRANSLATION_INTERVAL_MS);
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

    return this.textTranslator.translateSegment({
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
