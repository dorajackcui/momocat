import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROJECT_AI_MODEL, Segment, serializeTokensToDisplayText } from '@cat/core';
import { AIModule } from './AIModule';
import { AITransport, ProjectRepository, SegmentRepository, SettingsRepository } from '../ports';
import type { ProxySettingsApplier } from '../proxy/ProxySettingsManager';
import { SegmentService } from '../SegmentService';
import type { TBService } from '../TBService';
import type { TMService } from '../TMService';

function createSegment(params: {
  segmentId: string;
  sourceText: string;
  targetText?: string;
  status?: Segment['status'];
  context?: string;
}): Segment {
  const sourceTokens = params.sourceText
    ? [{ type: 'text', content: params.sourceText as string }]
    : [];
  const targetTokens = params.targetText
    ? [{ type: 'text', content: params.targetText as string }]
    : [];
  return {
    segmentId: params.segmentId,
    fileId: 1,
    orderIndex: 0,
    sourceTokens,
    targetTokens,
    status: params.status ?? 'new',
    tagsSignature: '',
    matchKey: params.sourceText.toLowerCase(),
    srcHash: `hash-${params.segmentId}`,
    meta: {
      context: params.context,
      updatedAt: new Date().toISOString(),
    },
  };
}

describe('AIModule.aiTranslateFile', () => {
  it('keeps scanning after consecutive empty source segments', async () => {
    const segments: Segment[] = [
      createSegment({ segmentId: 'empty-1', sourceText: '' }),
      createSegment({ segmentId: 'empty-2', sourceText: '' }),
      createSegment({ segmentId: 'empty-3', sourceText: '' }),
      createSegment({ segmentId: 'valid-1', sourceText: 'Hello world' }),
    ];

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi.fn().mockReturnValue({
        id: 11,
        srcLang: 'en',
        tgtLang: 'zh',
        aiPrompt: '',
        aiTemperature: 0.2,
      }),
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegmentsPage: vi.fn().mockReturnValue(segments),
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined),
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: '你好世界',
        status: 200,
        endpoint: '/v1/chat/completions',
      }),
    } as unknown as AITransport;

    const module = new AIModule(projectRepo, segmentRepo, settingsRepo, segmentService, transport);

    const result = await module.aiTranslateFile(1);

    expect(result.translated).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.total).toBe(4);
    expect(segmentService.updateSegment).toHaveBeenCalledTimes(1);
    expect(segmentService.updateSegment).toHaveBeenCalledWith(
      'valid-1',
      expect.any(Array),
      'translated',
    );

    const translatedTokens = (segmentService.updateSegment as ReturnType<typeof vi.fn>).mock
      .calls[0][1];
    expect(serializeTokensToDisplayText(translatedTokens)).toBe('你好世界');
  });

  it('includes imported context in user prompt', async () => {
    const segments: Segment[] = [
      createSegment({ segmentId: 'ctx-1', sourceText: 'Hello world', context: 'UI button label' }),
    ];

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi.fn().mockReturnValue({
        id: 11,
        srcLang: 'en',
        tgtLang: 'zh',
        aiPrompt: '',
        aiTemperature: 0.2,
      }),
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegmentsPage: vi
        .fn()
        .mockReturnValueOnce(segments)
        .mockReturnValueOnce([])
        .mockReturnValueOnce(segments)
        .mockReturnValueOnce([]),
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined),
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: '你好世界',
        status: 200,
        endpoint: '/v1/chat/completions',
      }),
    } as unknown as AITransport;

    const module = new AIModule(projectRepo, segmentRepo, settingsRepo, segmentService, transport);

    await module.aiTranslateFile(1);

    const userPrompt = (transport.chatCompletions as ReturnType<typeof vi.fn>).mock.calls[0][0]
      .userPrompt;
    expect(userPrompt).toContain('Context: UI button label');
  });

  it('injects TM/TB references into translation user prompt', async () => {
    const segments: Segment[] = [
      createSegment({ segmentId: 'ref-1', sourceText: 'Hello world', context: 'UI button label' }),
    ];

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi.fn().mockReturnValue({
        id: 11,
        srcLang: 'en',
        tgtLang: 'zh',
        aiPrompt: '',
        aiTemperature: 0.2,
      }),
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegmentsPage: vi.fn().mockReturnValue(segments),
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined),
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: '你好世界',
        status: 200,
        endpoint: '/v1/chat/completions',
      }),
    } as unknown as AITransport;

    const tmService = {
      findMatches: vi.fn().mockResolvedValue([
        {
          similarity: 100,
          tmName: 'Main TM',
          sourceTokens: [{ type: 'text', content: 'Hello world' }],
          targetTokens: [{ type: 'text', content: '你好世界' }],
        },
      ]),
    } as unknown as Pick<TMService, 'findMatches'>;

    const tbService = {
      findMatches: vi.fn().mockResolvedValue([
        { srcTerm: 'world', tgtTerm: '世界', note: null },
        { srcTerm: 'hello', tgtTerm: '你好', note: 'prefer short form' },
      ]),
    } as unknown as Pick<TBService, 'findMatches'>;

    const module = new AIModule(
      projectRepo,
      segmentRepo,
      settingsRepo,
      segmentService,
      transport,
      undefined,
      { tmService, tbService },
    );

    await module.aiTranslateFile(1);

    const userPrompt = (transport.chatCompletions as ReturnType<typeof vi.fn>).mock.calls[0][0]
      .userPrompt;
    expect(userPrompt).toContain('TM Reference (best match):');
    expect(userPrompt).toContain('- Similarity: 100% | TM: Main TM');
    expect(userPrompt).toContain('- Source: Hello world');
    expect(userPrompt).toContain('- Target: 你好世界');
    expect(userPrompt).toContain('Terminology References (hit terms):');
    expect(userPrompt).toContain('- world => 世界');
    expect(userPrompt).toContain('- hello => 你好 (note: prefer short form)');
    expect(tmService.findMatches).toHaveBeenCalledTimes(1);
    expect(tbService.findMatches).toHaveBeenCalledTimes(1);
  });

  it('keeps only top 5 TB references in translation prompt', async () => {
    const segments: Segment[] = [createSegment({ segmentId: 'ref-2', sourceText: 'Hello world' })];

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi.fn().mockReturnValue({
        id: 11,
        srcLang: 'en',
        tgtLang: 'zh',
        aiPrompt: '',
        aiTemperature: 0.2,
      }),
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegmentsPage: vi.fn().mockReturnValue(segments),
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined),
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: '你好世界',
        status: 200,
        endpoint: '/v1/chat/completions',
      }),
    } as unknown as AITransport;

    const tmService = {
      findMatches: vi.fn().mockResolvedValue([]),
    } as unknown as Pick<TMService, 'findMatches'>;

    const tbService = {
      findMatches: vi.fn().mockResolvedValue([
        { srcTerm: 't1', tgtTerm: 'v1', note: null },
        { srcTerm: 't2', tgtTerm: 'v2', note: null },
        { srcTerm: 't3', tgtTerm: 'v3', note: null },
        { srcTerm: 't4', tgtTerm: 'v4', note: null },
        { srcTerm: 't5', tgtTerm: 'v5', note: null },
        { srcTerm: 't6', tgtTerm: 'v6', note: null },
      ]),
    } as unknown as Pick<TBService, 'findMatches'>;

    const module = new AIModule(
      projectRepo,
      segmentRepo,
      settingsRepo,
      segmentService,
      transport,
      undefined,
      { tmService, tbService },
    );

    await module.aiTranslateFile(1);

    const userPrompt = (transport.chatCompletions as ReturnType<typeof vi.fn>).mock.calls[0][0]
      .userPrompt;
    expect(userPrompt).toContain('- t1 => v1');
    expect(userPrompt).toContain('- t5 => v5');
    expect(userPrompt).not.toContain('- t6 => v6');
  });

  it('does not resolve TM/TB references for review and custom projects', async () => {
    const tmService = {
      findMatches: vi.fn().mockResolvedValue([]),
    } as unknown as Pick<TMService, 'findMatches'>;
    const tbService = {
      findMatches: vi.fn().mockResolvedValue([]),
    } as unknown as Pick<TBService, 'findMatches'>;

    const runCase = async (projectType: 'review' | 'custom') => {
      const segments: Segment[] = [
        createSegment({ segmentId: `${projectType}-ref-1`, sourceText: 'Source text' }),
      ];
      const projectRepo = {
        getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
        getProject: vi.fn().mockReturnValue({
          id: 11,
          srcLang: 'en',
          tgtLang: 'zh',
          projectType,
          aiPrompt: '',
          aiTemperature: 0.2,
        }),
      } as unknown as ProjectRepository;
      const segmentRepo = {
        getSegmentsPage: vi.fn().mockReturnValue(segments),
      } as unknown as SegmentRepository;
      const settingsRepo = {
        getSetting: vi.fn().mockReturnValue('test-api-key'),
      } as unknown as SettingsRepository;
      const segmentService = {
        updateSegment: vi.fn().mockResolvedValue(undefined),
      } as unknown as SegmentService;
      const transport = {
        testConnection: vi.fn().mockResolvedValue({ ok: true }),
        chatCompletions: vi.fn().mockResolvedValue({
          content: '处理结果',
          status: 200,
          endpoint: '/v1/chat/completions',
        }),
      } as unknown as AITransport;

      const module = new AIModule(
        projectRepo,
        segmentRepo,
        settingsRepo,
        segmentService,
        transport,
        undefined,
        { tmService, tbService },
      );
      await module.aiTranslateFile(1);
    };

    await runCase('review');
    await runCase('custom');

    expect(tmService.findMatches).toHaveBeenCalledTimes(0);
    expect(tbService.findMatches).toHaveBeenCalledTimes(0);
  });

  it('continues translation when TM/TB reference resolving fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const segments: Segment[] = [
      createSegment({ segmentId: 'ref-fail-1', sourceText: 'Hello world' }),
    ];

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi.fn().mockReturnValue({
        id: 11,
        srcLang: 'en',
        tgtLang: 'zh',
        aiPrompt: '',
        aiTemperature: 0.2,
      }),
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegmentsPage: vi.fn().mockReturnValue(segments),
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined),
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: '你好世界',
        status: 200,
        endpoint: '/v1/chat/completions',
      }),
    } as unknown as AITransport;

    const tmService = {
      findMatches: vi.fn().mockRejectedValue(new Error('tm lookup failed')),
    } as unknown as Pick<TMService, 'findMatches'>;
    const tbService = {
      findMatches: vi.fn().mockRejectedValue(new Error('tb lookup failed')),
    } as unknown as Pick<TBService, 'findMatches'>;

    try {
      const module = new AIModule(
        projectRepo,
        segmentRepo,
        settingsRepo,
        segmentService,
        transport,
        undefined,
        { tmService, tbService },
      );
      const result = await module.aiTranslateFile(1);

      expect(result.translated).toBe(1);
      expect(result.failed).toBe(0);
      expect(segmentService.updateSegment).toHaveBeenCalledTimes(1);
      const userPrompt = (transport.chatCompletions as ReturnType<typeof vi.fn>).mock.calls[0][0]
        .userPrompt;
      expect(userPrompt).not.toContain('TM Reference (best match):');
      expect(userPrompt).not.toContain('Terminology References (hit terms):');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to resolve TM reference for segment ref-fail-1'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to resolve TB references for segment ref-fail-1'),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('uses project-level aiModel for file translation', async () => {
    const segments: Segment[] = [
      createSegment({ segmentId: 'model-1', sourceText: 'Hello world' }),
    ];

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi.fn().mockReturnValue({
        id: 11,
        srcLang: 'en',
        tgtLang: 'zh',
        aiPrompt: '',
        aiTemperature: 0.2,
        aiModel: 'gpt-5-mini',
      }),
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegmentsPage: vi.fn().mockReturnValue(segments),
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined),
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: '你好世界',
        status: 200,
        endpoint: '/v1/chat/completions',
      }),
    } as unknown as AITransport;

    const module = new AIModule(projectRepo, segmentRepo, settingsRepo, segmentService, transport);
    await module.aiTranslateFile(1);

    const request = (transport.chatCompletions as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(request.model).toBe('gpt-5-mini');
  });

  it('prefers request model over project aiModel when request model is valid', async () => {
    const segments: Segment[] = [
      createSegment({ segmentId: 'model-2', sourceText: 'Hello world' }),
    ];

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi.fn().mockReturnValue({
        id: 11,
        srcLang: 'en',
        tgtLang: 'zh',
        aiPrompt: '',
        aiTemperature: 0.2,
        aiModel: 'gpt-5-mini',
      }),
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegmentsPage: vi.fn().mockReturnValue(segments),
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined),
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: '你好世界',
        status: 200,
        endpoint: '/v1/chat/completions',
      }),
    } as unknown as AITransport;

    const module = new AIModule(projectRepo, segmentRepo, settingsRepo, segmentService, transport);
    await module.aiTranslateFile(1, { model: 'gpt-5.2' });

    const request = (transport.chatCompletions as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(request.model).toBe('gpt-5.2');
  });

  it('falls back to default model when both request and project model are invalid', async () => {
    const segments: Segment[] = [
      createSegment({ segmentId: 'model-3', sourceText: 'Hello world' }),
    ];

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi.fn().mockReturnValue({
        id: 11,
        srcLang: 'en',
        tgtLang: 'zh',
        aiPrompt: '',
        aiTemperature: 0.2,
        aiModel: 'unsupported-project-model',
      }),
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegmentsPage: vi.fn().mockReturnValue(segments),
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined),
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: '你好世界',
        status: 200,
        endpoint: '/v1/chat/completions',
      }),
    } as unknown as AITransport;

    const module = new AIModule(projectRepo, segmentRepo, settingsRepo, segmentService, transport);
    await module.aiTranslateFile(1, { model: 'unsupported-request-model' });

    const request = (transport.chatCompletions as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(request.model).toBe(DEFAULT_PROJECT_AI_MODEL);
  });

  it('omits context field in user prompt when imported context is missing', async () => {
    const segments: Segment[] = [
      createSegment({ segmentId: 'ctx-empty-1', sourceText: 'Hello world' }),
    ];

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi.fn().mockReturnValue({
        id: 11,
        srcLang: 'en',
        tgtLang: 'zh',
        aiPrompt: '',
        aiTemperature: 0.2,
      }),
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegmentsPage: vi
        .fn()
        .mockReturnValueOnce(segments)
        .mockReturnValueOnce([])
        .mockReturnValueOnce(segments)
        .mockReturnValueOnce([]),
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined),
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: '你好世界',
        status: 200,
        endpoint: '/v1/chat/completions',
      }),
    } as unknown as AITransport;

    const module = new AIModule(projectRepo, segmentRepo, settingsRepo, segmentService, transport);

    await module.aiTranslateFile(1);

    const userPrompt = (transport.chatCompletions as ReturnType<typeof vi.fn>).mock.calls[0][0]
      .userPrompt;
    expect(userPrompt).not.toContain('Context:');
  });

  it('keeps review language instruction when custom review prompt is provided', async () => {
    const segments: Segment[] = [
      createSegment({ segmentId: 'review-1', sourceText: 'Existing translation text' }),
    ];

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi.fn().mockReturnValue({
        id: 11,
        srcLang: 'en',
        tgtLang: 'zh',
        projectType: 'review',
        aiPrompt: 'Review only for terminology and fluency. Keep style concise.',
        aiTemperature: 0.2,
      }),
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegmentsPage: vi.fn().mockReturnValue(segments),
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined),
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: 'Existing translation text',
        status: 200,
        endpoint: '/v1/chat/completions',
      }),
    } as unknown as AITransport;

    const module = new AIModule(projectRepo, segmentRepo, settingsRepo, segmentService, transport);

    await module.aiTranslateFile(1);

    const systemPrompt = (transport.chatCompletions as ReturnType<typeof vi.fn>).mock.calls[0][0]
      .systemPrompt;
    expect(systemPrompt).toContain('Original text language: en. Translation text language: zh.');
    expect(systemPrompt).toContain('Review only for terminology and fluency. Keep style concise.');
  });

  it('allows unchanged output in review project during file processing', async () => {
    const segments: Segment[] = [
      createSegment({ segmentId: 'review-unchanged-1', sourceText: 'Already good text' }),
    ];

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi.fn().mockReturnValue({
        id: 11,
        srcLang: 'en',
        tgtLang: 'zh',
        projectType: 'review',
        aiPrompt: '',
        aiTemperature: 0.2,
      }),
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegmentsPage: vi.fn().mockReturnValue(segments),
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined),
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: 'Already good text',
        status: 200,
        endpoint: '/v1/chat/completions',
      }),
    } as unknown as AITransport;

    const module = new AIModule(projectRepo, segmentRepo, settingsRepo, segmentService, transport);

    const result = await module.aiTranslateFile(1);
    expect(result.failed).toBe(0);
    expect(result.translated).toBe(1);
    expect(segmentService.updateSegment).toHaveBeenCalledWith(
      'review-unchanged-1',
      expect.any(Array),
      'reviewed',
    );
  });

  it('uses custom prompt as full system prompt and custom input/context user prompt', async () => {
    const segments: Segment[] = [
      createSegment({
        segmentId: 'custom-1',
        sourceText: 'Input text',
        context: 'Context details',
      }),
    ];

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi.fn().mockReturnValue({
        id: 11,
        srcLang: 'en',
        tgtLang: 'zh',
        projectType: 'custom',
        aiPrompt: 'Classify the input and output only one label.',
        aiTemperature: 0.2,
      }),
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegmentsPage: vi.fn().mockReturnValue(segments),
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined),
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: 'positive',
        status: 200,
        endpoint: '/v1/chat/completions',
      }),
    } as unknown as AITransport;

    const module = new AIModule(projectRepo, segmentRepo, settingsRepo, segmentService, transport);
    await module.aiTranslateFile(1);

    const request = (transport.chatCompletions as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(request.systemPrompt).toBe('Classify the input and output only one label.');
    expect(request.userPrompt).toContain('Input:');
    expect(request.userPrompt).toContain('Input text');
    expect(request.userPrompt).toContain('Context: Context details');
    expect(segmentService.updateSegment).toHaveBeenCalledWith(
      'custom-1',
      expect.any(Array),
      'translated',
    );
  });

  it('allows unchanged output in custom project during file processing', async () => {
    const segments: Segment[] = [
      createSegment({ segmentId: 'custom-unchanged-1', sourceText: 'Same text' }),
    ];

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi.fn().mockReturnValue({
        id: 11,
        srcLang: 'en',
        tgtLang: 'zh',
        projectType: 'custom',
        aiPrompt: 'Return the input unchanged.',
        aiTemperature: 0.2,
      }),
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegmentsPage: vi.fn().mockReturnValue(segments),
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined),
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: 'Same text',
        status: 200,
        endpoint: '/v1/chat/completions',
      }),
    } as unknown as AITransport;

    const module = new AIModule(projectRepo, segmentRepo, settingsRepo, segmentService, transport);
    const result = await module.aiTranslateFile(1);
    expect(result.failed).toBe(0);
    expect(result.translated).toBe(1);
    expect(segmentService.updateSegment).toHaveBeenCalledWith(
      'custom-unchanged-1',
      expect.any(Array),
      'translated',
    );
  });

  it('includes tester context in aiTestTranslate user prompt', async () => {
    const projectRepo = {
      getProject: vi.fn().mockReturnValue({
        id: 11,
        srcLang: 'en',
        tgtLang: 'zh',
        projectType: 'custom',
        aiPrompt: 'Process text',
        aiTemperature: 0.2,
        aiModel: 'gpt-5.2',
      }),
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegmentsPage: vi.fn().mockReturnValue([]),
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined),
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: 'processed',
        status: 200,
        endpoint: '/v1/chat/completions',
      }),
    } as unknown as AITransport;

    const module = new AIModule(projectRepo, segmentRepo, settingsRepo, segmentService, transport);
    await module.aiTestTranslate(11, 'Input text', 'Additional context');

    const request = (transport.chatCompletions as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(request.model).toBe('gpt-5.2');
    expect(request.userPrompt).toContain('Input:');
    expect(request.userPrompt).toContain('Input text');
    expect(request.userPrompt).toContain('Context: Additional context');
  });
});

describe('AIModule.aiTranslateSegment', () => {
  it('translates one segment with the same prompt references as file translation', async () => {
    const segment = createSegment({
      segmentId: 'single-1',
      sourceText: 'Hello world',
      context: 'UI button label',
      targetText: '旧译文',
      status: 'draft',
    });

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi.fn().mockReturnValue({
        id: 11,
        srcLang: 'en',
        tgtLang: 'zh',
        aiPrompt: '',
        aiTemperature: 0.2,
      }),
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegment: vi.fn().mockReturnValue(segment),
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined),
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: '你好世界',
        status: 200,
        endpoint: '/v1/chat/completions',
      }),
    } as unknown as AITransport;

    const tmService = {
      findMatches: vi.fn().mockResolvedValue([
        {
          similarity: 99,
          tmName: 'Main TM',
          sourceTokens: [{ type: 'text', content: 'Hello world' }],
          targetTokens: [{ type: 'text', content: '你好世界' }],
        },
      ]),
    } as unknown as Pick<TMService, 'findMatches'>;

    const tbService = {
      findMatches: vi.fn().mockResolvedValue([{ srcTerm: 'world', tgtTerm: '世界', note: null }]),
    } as unknown as Pick<TBService, 'findMatches'>;

    const module = new AIModule(
      projectRepo,
      segmentRepo,
      settingsRepo,
      segmentService,
      transport,
      undefined,
      { tmService, tbService },
    );

    const result = await module.aiTranslateSegment('single-1');

    expect(result).toEqual({ segmentId: 'single-1', status: 'translated' });
    expect(segmentService.updateSegment).toHaveBeenCalledWith(
      'single-1',
      expect.any(Array),
      'translated',
    );
    const request = (transport.chatCompletions as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(request.userPrompt).toContain('Context: UI button label');
    expect(request.userPrompt).toContain('TM Reference (best match):');
    expect(request.userPrompt).toContain('Terminology References (hit terms):');
  });

  it('returns reviewed status for review project', async () => {
    const segment = createSegment({
      segmentId: 'single-review-1',
      sourceText: 'Review this text',
      targetText: '初稿',
      status: 'draft',
    });

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi.fn().mockReturnValue({
        id: 11,
        srcLang: 'en',
        tgtLang: 'zh',
        projectType: 'review',
        aiPrompt: '',
        aiTemperature: 0.2,
      }),
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegment: vi.fn().mockReturnValue(segment),
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined),
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: 'Review this text',
        status: 200,
        endpoint: '/v1/chat/completions',
      }),
    } as unknown as AITransport;

    const module = new AIModule(projectRepo, segmentRepo, settingsRepo, segmentService, transport);
    const result = await module.aiTranslateSegment('single-review-1');

    expect(result).toEqual({ segmentId: 'single-review-1', status: 'reviewed' });
    expect(segmentService.updateSegment).toHaveBeenCalledWith(
      'single-review-1',
      expect.any(Array),
      'reviewed',
    );
  });
});

describe('AIModule.aiRefineSegment', () => {
  it('refines one segment with refinement prompt fields and translation references', async () => {
    const segment = createSegment({
      segmentId: 'refine-1',
      sourceText: 'Hello world',
      targetText: '你好世界',
      context: 'UI button label',
      status: 'draft',
    });

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi.fn().mockReturnValue({
        id: 11,
        srcLang: 'en',
        tgtLang: 'zh',
        aiPrompt: '',
        aiTemperature: 0.2,
      }),
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegment: vi.fn().mockReturnValue(segment),
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined),
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: '你好，世界',
        status: 200,
        endpoint: '/v1/chat/completions',
      }),
    } as unknown as AITransport;

    const tmService = {
      findMatches: vi.fn().mockResolvedValue([
        {
          similarity: 99,
          tmName: 'Main TM',
          sourceTokens: [{ type: 'text', content: 'Hello world' }],
          targetTokens: [{ type: 'text', content: '你好世界' }],
        },
      ]),
    } as unknown as Pick<TMService, 'findMatches'>;

    const tbService = {
      findMatches: vi.fn().mockResolvedValue([{ srcTerm: 'world', tgtTerm: '世界', note: null }]),
    } as unknown as Pick<TBService, 'findMatches'>;

    const module = new AIModule(
      projectRepo,
      segmentRepo,
      settingsRepo,
      segmentService,
      transport,
      undefined,
      { tmService, tbService },
    );

    const result = await module.aiRefineSegment('refine-1', 'Make the tone concise');

    expect(result).toEqual({ segmentId: 'refine-1', status: 'translated' });
    expect(segmentService.updateSegment).toHaveBeenCalledWith(
      'refine-1',
      expect.any(Array),
      'translated',
    );
    const request = (transport.chatCompletions as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(request.userPrompt).toContain('Context: UI button label');
    expect(request.userPrompt).toContain('Current Translation:');
    expect(request.userPrompt).toContain('你好世界');
    expect(request.userPrompt).toContain('Refinement Instruction:');
    expect(request.userPrompt).toContain('Make the tone concise');
    expect(request.userPrompt).toContain('TM Reference (best match):');
    expect(request.userPrompt).toContain('Terminology References (hit terms):');
  });

  it('returns reviewed status for review project', async () => {
    const segment = createSegment({
      segmentId: 'refine-review-1',
      sourceText: 'Review this text',
      targetText: '初稿',
      status: 'draft',
    });

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi.fn().mockReturnValue({
        id: 11,
        srcLang: 'en',
        tgtLang: 'zh',
        projectType: 'review',
        aiPrompt: '',
        aiTemperature: 0.2,
      }),
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegment: vi.fn().mockReturnValue(segment),
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined),
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: '修改后译文',
        status: 200,
        endpoint: '/v1/chat/completions',
      }),
    } as unknown as AITransport;

    const module = new AIModule(projectRepo, segmentRepo, settingsRepo, segmentService, transport);
    const result = await module.aiRefineSegment('refine-review-1', 'Fix terminology only');

    expect(result).toEqual({ segmentId: 'refine-review-1', status: 'reviewed' });
    expect(segmentService.updateSegment).toHaveBeenCalledWith(
      'refine-review-1',
      expect.any(Array),
      'reviewed',
    );
  });

  it('throws when refinement instruction is empty', async () => {
    const segment = createSegment({
      segmentId: 'refine-empty-inst-1',
      sourceText: 'Hello',
      targetText: '你好',
      status: 'draft',
    });

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi.fn().mockReturnValue({
        id: 11,
        srcLang: 'en',
        tgtLang: 'zh',
        aiPrompt: '',
        aiTemperature: 0.2,
      }),
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegment: vi.fn().mockReturnValue(segment),
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined),
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn(),
    } as unknown as AITransport;

    const module = new AIModule(projectRepo, segmentRepo, settingsRepo, segmentService, transport);

    await expect(module.aiRefineSegment('refine-empty-inst-1', '   ')).rejects.toThrow(
      'Refinement instruction is empty',
    );
    expect(transport.chatCompletions).not.toHaveBeenCalled();
    expect(segmentService.updateSegment).not.toHaveBeenCalled();
  });

  it('throws when current target is empty', async () => {
    const segment = createSegment({
      segmentId: 'refine-empty-target-1',
      sourceText: 'Hello',
      targetText: '',
      status: 'new',
    });

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi.fn().mockReturnValue({
        id: 11,
        srcLang: 'en',
        tgtLang: 'zh',
        aiPrompt: '',
        aiTemperature: 0.2,
      }),
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegment: vi.fn().mockReturnValue(segment),
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined),
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn(),
    } as unknown as AITransport;

    const module = new AIModule(projectRepo, segmentRepo, settingsRepo, segmentService, transport);

    await expect(
      module.aiRefineSegment('refine-empty-target-1', 'Make it shorter'),
    ).rejects.toThrow('Target segment is empty');
    expect(transport.chatCompletions).not.toHaveBeenCalled();
    expect(segmentService.updateSegment).not.toHaveBeenCalled();
  });
});

describe('AIModule.proxySettings', () => {
  it('returns system mode by default when no proxy settings are stored', () => {
    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue(undefined),
      setSetting: vi.fn(),
    } as unknown as SettingsRepository;

    const proxySettingsManager = {
      getEffectiveProxyUrl: vi.fn().mockReturnValue(undefined),
      applySettings: vi.fn(),
    } as unknown as ProxySettingsApplier;

    const module = new AIModule(
      {} as ProjectRepository,
      {} as SegmentRepository,
      settingsRepo,
      {} as SegmentService,
      {} as AITransport,
      proxySettingsManager,
    );

    expect(module.getProxySettings()).toEqual({
      mode: 'system',
      customProxyUrl: '',
      effectiveProxyUrl: undefined,
    });
  });

  it('applies and persists custom proxy settings', () => {
    const settingsStore = new Map<string, string>();
    const settingsRepo = {
      getSetting: vi.fn((key: string) => settingsStore.get(key)),
      setSetting: vi.fn((key: string, value: string | null) => {
        if (value === null) {
          settingsStore.delete(key);
          return;
        }
        settingsStore.set(key, value);
      }),
    } as unknown as SettingsRepository;

    const proxySettingsManager = {
      getEffectiveProxyUrl: vi.fn().mockReturnValue('http://127.0.0.1:7890'),
      applySettings: vi.fn().mockReturnValue({
        mode: 'custom',
        customProxyUrl: 'http://127.0.0.1:7890',
        effectiveProxyUrl: 'http://127.0.0.1:7890',
      }),
    } as unknown as ProxySettingsApplier;

    const module = new AIModule(
      {} as ProjectRepository,
      {} as SegmentRepository,
      settingsRepo,
      {} as SegmentService,
      {} as AITransport,
      proxySettingsManager,
    );

    const result = module.setProxySettings({
      mode: 'custom',
      customProxyUrl: ' http://127.0.0.1:7890 ',
    });

    expect(proxySettingsManager.applySettings).toHaveBeenCalledWith({
      mode: 'custom',
      customProxyUrl: 'http://127.0.0.1:7890',
    });
    expect(settingsRepo.setSetting).toHaveBeenCalledWith('app_proxy_mode', 'custom');
    expect(settingsRepo.setSetting).toHaveBeenCalledWith('app_proxy_url', 'http://127.0.0.1:7890');
    expect(result).toEqual({
      mode: 'custom',
      customProxyUrl: 'http://127.0.0.1:7890',
      effectiveProxyUrl: 'http://127.0.0.1:7890',
    });
  });

  it('applies saved proxy settings on startup', () => {
    const settingsRepo = {
      getSetting: vi.fn((key: string) => {
        if (key === 'app_proxy_mode') return 'custom';
        if (key === 'app_proxy_url') return 'http://127.0.0.1:7890';
        return undefined;
      }),
      setSetting: vi.fn(),
    } as unknown as SettingsRepository;

    const proxySettingsManager = {
      getEffectiveProxyUrl: vi.fn().mockReturnValue('http://127.0.0.1:7890'),
      applySettings: vi.fn().mockReturnValue({
        mode: 'custom',
        customProxyUrl: 'http://127.0.0.1:7890',
        effectiveProxyUrl: 'http://127.0.0.1:7890',
      }),
    } as unknown as ProxySettingsApplier;

    const module = new AIModule(
      {} as ProjectRepository,
      {} as SegmentRepository,
      settingsRepo,
      {} as SegmentService,
      {} as AITransport,
      proxySettingsManager,
    );

    const result = module.applySavedProxySettings();

    expect(proxySettingsManager.applySettings).toHaveBeenCalledWith({
      mode: 'custom',
      customProxyUrl: 'http://127.0.0.1:7890',
    });
    expect(result).toEqual({
      mode: 'custom',
      customProxyUrl: 'http://127.0.0.1:7890',
      effectiveProxyUrl: 'http://127.0.0.1:7890',
    });
  });
});
