import { describe, expect, it, vi } from 'vitest';
import { Segment, serializeTokensToDisplayText } from '@cat/core';
import { AIModule } from './AIModule';
import { AITransport, ProjectRepository, SegmentRepository, SettingsRepository } from '../ports';
import { SegmentService } from '../SegmentService';

function createSegment(params: {
  segmentId: string;
  sourceText: string;
  targetText?: string;
  status?: Segment['status'];
  context?: string;
}): Segment {
  const sourceTokens = params.sourceText ? [{ type: 'text', content: params.sourceText as string }] : [];
  const targetTokens = params.targetText ? [{ type: 'text', content: params.targetText as string }] : [];
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
      updatedAt: new Date().toISOString()
    }
  };
}

describe('AIModule.aiTranslateFile', () => {
  it('keeps scanning after consecutive empty source segments', async () => {
    const segments: Segment[] = [
      createSegment({ segmentId: 'empty-1', sourceText: '' }),
      createSegment({ segmentId: 'empty-2', sourceText: '' }),
      createSegment({ segmentId: 'empty-3', sourceText: '' }),
      createSegment({ segmentId: 'valid-1', sourceText: 'Hello world' })
    ];

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi
        .fn()
        .mockReturnValue({ id: 11, srcLang: 'en', tgtLang: 'zh', aiPrompt: '', aiTemperature: 0.2 })
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegmentsPage: vi.fn().mockReturnValue(segments)
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key')
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined)
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: '你好世界',
        status: 200,
        endpoint: '/v1/chat/completions'
      })
    } as unknown as AITransport;

    const module = new AIModule(projectRepo, segmentRepo, settingsRepo, segmentService, transport);

    const result = await module.aiTranslateFile(1);

    expect(result.translated).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.total).toBe(4);
    expect(segmentService.updateSegment).toHaveBeenCalledTimes(1);
    expect(segmentService.updateSegment).toHaveBeenCalledWith('valid-1', expect.any(Array), 'translated');

    const translatedTokens = (segmentService.updateSegment as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(serializeTokensToDisplayText(translatedTokens)).toBe('你好世界');
  });

  it('includes imported context in user prompt', async () => {
    const segments: Segment[] = [
      createSegment({ segmentId: 'ctx-1', sourceText: 'Hello world', context: 'UI button label' })
    ];

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi
        .fn()
        .mockReturnValue({ id: 11, srcLang: 'en', tgtLang: 'zh', aiPrompt: '', aiTemperature: 0.2 })
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegmentsPage: vi
        .fn()
        .mockReturnValueOnce(segments)
        .mockReturnValueOnce([])
        .mockReturnValueOnce(segments)
        .mockReturnValueOnce([])
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key')
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined)
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: '你好世界',
        status: 200,
        endpoint: '/v1/chat/completions'
      })
    } as unknown as AITransport;

    const module = new AIModule(projectRepo, segmentRepo, settingsRepo, segmentService, transport);

    await module.aiTranslateFile(1);

    const userPrompt = (transport.chatCompletions as ReturnType<typeof vi.fn>).mock.calls[0][0].userPrompt;
    expect(userPrompt).toContain('Context: UI button label');
  });

  it('keeps context field in user prompt when imported context is missing', async () => {
    const segments: Segment[] = [
      createSegment({ segmentId: 'ctx-empty-1', sourceText: 'Hello world' })
    ];

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi
        .fn()
        .mockReturnValue({ id: 11, srcLang: 'en', tgtLang: 'zh', aiPrompt: '', aiTemperature: 0.2 })
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegmentsPage: vi
        .fn()
        .mockReturnValueOnce(segments)
        .mockReturnValueOnce([])
        .mockReturnValueOnce(segments)
        .mockReturnValueOnce([])
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key')
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined)
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: '你好世界',
        status: 200,
        endpoint: '/v1/chat/completions'
      })
    } as unknown as AITransport;

    const module = new AIModule(projectRepo, segmentRepo, settingsRepo, segmentService, transport);

    await module.aiTranslateFile(1);

    const userPrompt = (transport.chatCompletions as ReturnType<typeof vi.fn>).mock.calls[0][0].userPrompt;
    expect(userPrompt).toContain('Context: ');
  });

  it('keeps review language instruction when custom review prompt is provided', async () => {
    const segments: Segment[] = [
      createSegment({ segmentId: 'review-1', sourceText: 'Existing translation text' })
    ];

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi.fn().mockReturnValue({
        id: 11,
        srcLang: 'en',
        tgtLang: 'zh',
        projectType: 'review',
        aiPrompt: 'Review only for terminology and fluency. Keep style concise.',
        aiTemperature: 0.2
      })
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegmentsPage: vi.fn().mockReturnValue(segments)
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key')
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined)
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: 'Existing translation text',
        status: 200,
        endpoint: '/v1/chat/completions'
      })
    } as unknown as AITransport;

    const module = new AIModule(projectRepo, segmentRepo, settingsRepo, segmentService, transport);

    await module.aiTranslateFile(1);

    const systemPrompt = (transport.chatCompletions as ReturnType<typeof vi.fn>).mock.calls[0][0].systemPrompt;
    expect(systemPrompt).toContain('Original text language: en. Translation text language: zh.');
    expect(systemPrompt).toContain('Review only for terminology and fluency. Keep style concise.');
  });

  it('allows unchanged output in review project during file processing', async () => {
    const segments: Segment[] = [
      createSegment({ segmentId: 'review-unchanged-1', sourceText: 'Already good text' })
    ];

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 11, name: 'demo.xlsx' }),
      getProject: vi.fn().mockReturnValue({
        id: 11,
        srcLang: 'en',
        tgtLang: 'zh',
        projectType: 'review',
        aiPrompt: '',
        aiTemperature: 0.2
      })
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegmentsPage: vi.fn().mockReturnValue(segments)
    } as unknown as SegmentRepository;

    const settingsRepo = {
      getSetting: vi.fn().mockReturnValue('test-api-key')
    } as unknown as SettingsRepository;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue(undefined)
    } as unknown as SegmentService;

    const transport = {
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      chatCompletions: vi.fn().mockResolvedValue({
        content: 'Already good text',
        status: 200,
        endpoint: '/v1/chat/completions'
      })
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
    expect(request.userPrompt).toContain('Input:');
    expect(request.userPrompt).toContain('Input text');
    expect(request.userPrompt).toContain('Context: Additional context');
  });
});
