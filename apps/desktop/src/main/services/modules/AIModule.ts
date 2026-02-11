import {
  Segment,
  Token,
  TagValidator,
  parseEditorTextToTokens,
  serializeTokensToDisplayText,
  serializeTokensToEditorText,
} from '@cat/core';
import { AITransport, ProjectRepository, SegmentRepository, SettingsRepository } from '../ports';
import { SegmentService } from '../SegmentService';

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
  private readonly tagValidator = new TagValidator();

  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly segmentRepo: SegmentRepository,
    private readonly settingsRepo: SettingsRepository,
    private readonly segmentService: SegmentService,
    private readonly transport: AITransport,
  ) {}

  public getAISettings(): { apiKeySet: boolean; apiKeyLast4?: string } {
    const apiKey = this.settingsRepo.getSetting('openai_api_key');
    if (!apiKey) {
      return { apiKeySet: false };
    }
    return { apiKeySet: true, apiKeyLast4: apiKey.slice(-4) };
  }

  public setAIKey(apiKey: string) {
    this.settingsRepo.setSetting('openai_api_key', apiKey);
  }

  public clearAIKey() {
    this.settingsRepo.setSetting('openai_api_key', null);
  }

  public async testAIConnection(apiKey?: string) {
    const key = (apiKey && apiKey.trim()) || this.settingsRepo.getSetting('openai_api_key');
    if (!key) {
      throw new Error('API key is not set');
    }
    return this.transport.testConnection(key);
  }

  public async aiTranslateFile(
    fileId: number,
    options?: {
      model?: string;
      onProgress?: (data: { current: number; total: number; message?: string }) => void;
    },
  ) {
    const file = this.projectRepo.getFile(fileId);
    if (!file) throw new Error('File not found');

    const project = this.projectRepo.getProject(file.projectId);
    if (!project) throw new Error('Project not found');

    const apiKey = this.settingsRepo.getSetting('openai_api_key');
    if (!apiKey) {
      throw new Error('AI API key is not configured');
    }

    const model = options?.model || 'gpt-4o-mini';
    const temperature = this.resolveTemperature(project.aiTemperature);
    const totalSegments = this.countFileSegments(fileId);
    const total = this.countTranslatableSegments(fileId);
    let current = 0;
    let translated = 0;
    const skipped = totalSegments - total;
    let failed = 0;

    for (const seg of this.iterateFileSegments(fileId)) {
      if (!this.isTranslatableSegment(seg)) continue;

      current += 1;
      options?.onProgress?.({
        current,
        total,
        message: `Translating segment ${current} of ${total}`,
      });

      const sourceText = serializeTokensToDisplayText(seg.sourceTokens);
      const sourceTagPreservedText = serializeTokensToEditorText(
        seg.sourceTokens,
        seg.sourceTokens,
      );
      const context = seg.meta?.context ? String(seg.meta.context).trim() : '';

      try {
        const targetTokens = await this.translateSegment({
          apiKey,
          model,
          projectPrompt: project.aiPrompt || '',
          temperature,
          srcLang: project.srcLang,
          tgtLang: project.tgtLang,
          sourceTokens: seg.sourceTokens,
          sourceText,
          sourceTagPreservedText,
          context,
        });

        await this.segmentService.updateSegment(seg.segmentId, targetTokens, 'translated');
        translated += 1;
      } catch {
        failed += 1;
      }

      await new Promise((resolve) => setTimeout(resolve, 40));
    }

    return { translated, skipped, failed, total: totalSegments };
  }

  public async aiTestTranslate(projectId: number, sourceText: string) {
    const project = this.projectRepo.getProject(projectId);
    if (!project) throw new Error('Project not found');

    const apiKey = this.settingsRepo.getSetting('openai_api_key');
    if (!apiKey) {
      throw new Error('AI API key is not configured');
    }

    const model = 'gpt-4o-mini';
    const temperature = this.resolveTemperature(project.aiTemperature);
    const source = sourceText.trim();
    const promptUsed = this.buildSystemPrompt(
      project.srcLang,
      project.tgtLang,
      project.aiPrompt || '',
    );
    const userMessage = [`Source (${project.srcLang}):`, source].join('\n');
    const debug: TranslateDebugMeta = {};

    try {
      const translatedText = await this.translateText({
        apiKey,
        model,
        projectPrompt: project.aiPrompt || '',
        temperature,
        srcLang: project.srcLang,
        tgtLang: project.tgtLang,
        sourceText: source,
        debug,
        allowUnchanged: true,
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

  private buildSystemPrompt(srcLang: string, tgtLang: string, projectPrompt?: string) {
    const base = [
      `Translate from ${srcLang} to ${tgtLang}.`,
      'The source can include protected markers such as {1>, <2}, {3}.',
      'Never translate, remove, reorder, renumber, or rewrite protected markers.',
      'Keep all tags, placeholders, and formatting exactly as they appear in the source.',
      'Return only the translated text, without quotes or extra commentary.',
      'Do not copy the source text unless it is already in the target language.',
    ].join('\n');

    const trimmed = projectPrompt?.trim();
    if (!trimmed) return `You are a professional translator.\n${base}`;
    return `${trimmed}\n${base}`;
  }

  private async translateSegment(params: {
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
      const translatedText = await this.translateText({
        apiKey: params.apiKey,
        model: params.model,
        projectPrompt: params.projectPrompt,
        temperature: params.temperature,
        srcLang: params.srcLang,
        tgtLang: params.tgtLang,
        sourceText: params.sourceText,
        sourceTagPreservedText: params.sourceTagPreservedText,
        context: params.context,
        validationFeedback,
      });

      const targetTokens = parseEditorTextToTokens(translatedText, params.sourceTokens);
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
    temperature?: number;
    srcLang: string;
    tgtLang: string;
    sourceText: string;
    sourceTagPreservedText?: string;
    context?: string;
    validationFeedback?: string;
    debug?: TranslateDebugMeta;
    allowUnchanged?: boolean;
  }): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(
      params.srcLang,
      params.tgtLang,
      params.projectPrompt,
    );
    const hasProtectedMarkers =
      typeof params.sourceTagPreservedText === 'string' && params.sourceTagPreservedText.length > 0;
    const sourcePayload = hasProtectedMarkers ? params.sourceTagPreservedText! : params.sourceText;
    const userParts = [
      hasProtectedMarkers
        ? `Source (${params.srcLang}, protected-marker format):`
        : `Source (${params.srcLang}):`,
      sourcePayload,
    ];

    if (params.context) {
      userParts.push('', `Context: ${params.context}`);
    }

    if (params.validationFeedback) {
      userParts.push('', 'Validation feedback from previous attempt:', params.validationFeedback);
    }

    params.debug && (params.debug.model = params.model);

    const response = await this.transport.chatCompletions({
      apiKey: params.apiKey,
      model: params.model,
      temperature: this.resolveTemperature(params.temperature),
      systemPrompt,
      userPrompt: userParts.join('\n'),
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
    if (
      !params.allowUnchanged &&
      (unchangedAgainstSource || unchangedAgainstPayload) &&
      params.srcLang !== params.tgtLang
    ) {
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

  private isTranslatableSegment(segment: Segment): boolean {
    const sourceText = serializeTokensToDisplayText(segment.sourceTokens).trim();
    if (!sourceText) return false;
    if (segment.status === 'confirmed') return false;
    const existingTarget = serializeTokensToDisplayText(segment.targetTokens).trim();
    return existingTarget.length === 0;
  }

  private countFileSegments(fileId: number): number {
    let count = 0;
    let offset = 0;

    while (true) {
      const page = this.segmentRepo.getSegmentsPage(fileId, offset, AIModule.SEGMENT_PAGE_SIZE);
      if (page.length === 0) return count;
      count += page.length;
      if (page.length < AIModule.SEGMENT_PAGE_SIZE) return count;
      offset += AIModule.SEGMENT_PAGE_SIZE;
    }
  }

  private countTranslatableSegments(fileId: number): number {
    let count = 0;
    for (const segment of this.iterateFileSegments(fileId)) {
      if (this.isTranslatableSegment(segment)) {
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
