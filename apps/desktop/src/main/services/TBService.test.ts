import { describe, expect, it } from 'vitest';
import { Segment } from '@cat/core';
import { TBService } from './TBService';
import type { TBRepository } from './ports';

function buildSegment(sourceText: string): Segment {
  return {
    segmentId: 'seg-1',
    fileId: 1,
    orderIndex: 0,
    sourceTokens: [{ type: 'text', content: sourceText }],
    targetTokens: [],
    status: 'new',
    tagsSignature: '',
    matchKey: sourceText.toLowerCase(),
    srcHash: sourceText.toLowerCase(),
    meta: {
      updatedAt: new Date().toISOString(),
    },
  };
}

function createServiceWithEntries(entries: ReturnType<TBRepository['listProjectTermEntries']>) {
  const dbMock = {
    listProjectTermEntries: () => entries,
  } satisfies Pick<TBRepository, 'listProjectTermEntries'>;
  return new TBService(dbMock as TBRepository);
}

describe('TBService', () => {
  it('matches latin term with word boundary and ignores partial word match', async () => {
    const service = createServiceWithEntries([
      {
        id: 'tb-1',
        tbId: 'tb-a',
        srcTerm: 'winter',
        tgtTerm: 'hiver',
        srcNorm: 'winter',
        note: null,
        createdAt: '',
        updatedAt: '',
        usageCount: 1,
        tbName: 'Season TB',
        priority: 1,
      },
      {
        id: 'tb-2',
        tbId: 'tb-a',
        srcTerm: 'win',
        tgtTerm: '胜利',
        srcNorm: 'win',
        note: null,
        createdAt: '',
        updatedAt: '',
        usageCount: 1,
        tbName: 'Noise TB',
        priority: 2,
      },
    ]);

    const matches = await service.findMatches(1, buildSegment('Warmth Amid Winter'));
    expect(matches).toHaveLength(1);
    expect(matches[0].srcTerm).toBe('winter');
    expect(matches[0].tgtTerm).toBe('hiver');
  });

  it('matches cjk term in sentence', async () => {
    const service = createServiceWithEntries([
      {
        id: 'tb-3',
        tbId: 'tb-b',
        srcTerm: '设置',
        tgtTerm: 'settings',
        srcNorm: '设置',
        note: null,
        createdAt: '',
        updatedAt: '',
        usageCount: 1,
        tbName: 'UI TB',
        priority: 1,
      },
    ]);

    const matches = await service.findMatches(1, buildSegment('请点击设置按钮然后保存'));
    expect(matches).toHaveLength(1);
    expect(matches[0].positions.length).toBe(1);
    expect(matches[0].positions[0].start).toBe(3);
  });

  it('sorts by longer source term first', async () => {
    const service = createServiceWithEntries([
      {
        id: 'tb-4',
        tbId: 'tb-c',
        srcTerm: 'Winter',
        tgtTerm: 'Hiver',
        srcNorm: 'winter',
        note: null,
        createdAt: '',
        updatedAt: '',
        usageCount: 1,
        tbName: 'TB 1',
        priority: 1,
      },
      {
        id: 'tb-5',
        tbId: 'tb-c',
        srcTerm: 'Amid Winter',
        tgtTerm: "au coeur de l'hiver",
        srcNorm: 'amid winter',
        note: null,
        createdAt: '',
        updatedAt: '',
        usageCount: 1,
        tbName: 'TB 1',
        priority: 1,
      },
    ]);

    const matches = await service.findMatches(1, buildSegment('Warmth Amid Winter'));
    expect(matches).toHaveLength(2);
    expect(matches[0].srcTerm).toBe('Amid Winter');
    expect(matches[1].srcTerm).toBe('Winter');
  });

  it('deduplicates by normalized source term and keeps higher-priority mounted term base entry', async () => {
    const service = createServiceWithEntries([
      {
        id: 'tb-6',
        tbId: 'tb-priority-1',
        srcTerm: 'API Key',
        tgtTerm: 'clé API',
        srcNorm: 'api key',
        note: null,
        createdAt: '',
        updatedAt: '',
        usageCount: 1,
        tbName: 'Priority TB',
        priority: 1,
      },
      {
        id: 'tb-7',
        tbId: 'tb-priority-9',
        srcTerm: 'api key',
        tgtTerm: "clef d'API",
        srcNorm: 'api key',
        note: null,
        createdAt: '',
        updatedAt: '',
        usageCount: 1,
        tbName: 'Low Priority TB',
        priority: 9,
      },
    ]);

    const matches = await service.findMatches(1, buildSegment('Please keep your API key secure.'));
    expect(matches).toHaveLength(1);
    expect(matches[0].tbName).toBe('Priority TB');
    expect(matches[0].tgtTerm).toBe('clé API');
  });
});
