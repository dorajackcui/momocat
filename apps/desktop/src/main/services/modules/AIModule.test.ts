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
});
