import { afterEach, describe, expect, it, vi } from 'vitest';
import { Segment, Token } from '@cat/core';
import { TMModule } from './TMModule';
import { ProjectRepository, SegmentRepository, TMRepository, TransactionManager } from '../ports';
import { TMService } from '../TMService';
import { SegmentService } from '../SegmentService';
import { CATDatabase } from '../../../../../../packages/db/src';
import { SqliteProjectRepository } from '../adapters/SqliteProjectRepository';
import { SqliteSegmentRepository } from '../adapters/SqliteSegmentRepository';
import { SqliteTMRepository } from '../adapters/SqliteTMRepository';
import { SqliteTransactionManager } from '../adapters/SqliteTransactionManager';

function createSegment(segmentId: string, srcHash: string, status: Segment['status']): Segment {
  return {
    segmentId,
    fileId: 1,
    orderIndex: 0,
    sourceTokens: [{ type: 'text', content: 'Hello' }],
    targetTokens: [],
    status,
    tagsSignature: '',
    matchKey: 'hello',
    srcHash,
    meta: {
      updatedAt: new Date().toISOString()
    }
  };
}

describe('TMModule.batchMatchFileWithTM', () => {
  let db: CATDatabase | undefined;

  afterEach(() => {
    db?.close();
    db = undefined;
  });

  it('uses segment confirmation flow instead of directly writing segment repository', async () => {
    const matchedTokens: Token[] = [{ type: 'text', content: '你好' }];
    const segments = [
      createSegment('seg-1', 'hash-1', 'new'),
      createSegment('seg-2', 'hash-2', 'confirmed'),
      createSegment('seg-3', 'hash-3', 'new')
    ];

    const projectRepo = {
      getFile: vi.fn().mockReturnValue({ id: 1, projectId: 1, name: 'demo.xlsx' })
    } as unknown as ProjectRepository;

    const segmentRepo = {
      getSegmentsPage: vi.fn().mockReturnValue(segments),
      updateSegmentTarget: vi.fn()
    } as unknown as SegmentRepository;

    const tmRepo = {
      getTM: vi.fn().mockReturnValue({ id: 'tm-1', srcLang: 'en', tgtLang: 'zh' }),
      findTMEntryByHash: vi.fn((_: string, srcHash: string) => {
        if (srcHash === 'hash-1' || srcHash === 'hash-2') {
          return { targetTokens: matchedTokens };
        }
        return undefined;
      })
    } as unknown as TMRepository;

    const tx = {
      runInTransaction: <T>(fn: () => T) => fn()
    } as TransactionManager;

    const segmentService = {
      updateSegment: vi.fn().mockResolvedValue({ propagatedIds: [] })
    } as unknown as SegmentService;

    const module = new TMModule(
      projectRepo,
      segmentRepo,
      tmRepo,
      tx,
      {} as TMService,
      segmentService,
      ':memory:',
      vi.fn()
    );

    const result = await module.batchMatchFileWithTM(1, 'tm-1');

    expect(result).toEqual({
      total: 3,
      matched: 2,
      applied: 1,
      skipped: 1
    });

    expect(segmentService.updateSegment).toHaveBeenCalledTimes(1);
    expect(segmentService.updateSegment).toHaveBeenCalledWith('seg-1', matchedTokens, 'confirmed');
    expect(segmentRepo.updateSegmentTarget).not.toHaveBeenCalled();
  });

  it('keeps propagation, Working TM updates, and events consistent with manual confirmations', async () => {
    db = new CATDatabase(':memory:');
    const projectId = db.createProject('Batch Match', 'en', 'zh');
    const fileId = db.createFile(projectId, 'batch.xlsx');
    const srcHash = 'hash-hello';

    const segments: Segment[] = [
      createSegment('seg-1', srcHash, 'new'),
      createSegment('seg-2', srcHash, 'new'),
      createSegment('seg-3', 'hash-miss', 'new')
    ].map((segment, index) => ({ ...segment, fileId, orderIndex: index }));

    db.bulkInsertSegments(segments);

    const mainTmId = db.createTM('Main TM', 'en', 'zh', 'main');
    db.mountTMToProject(projectId, mainTmId, 10, 'read');

    const matchedTokens: Token[] = [{ type: 'text', content: '你好' }];
    const now = new Date().toISOString();
    const entryId = db.upsertTMEntryBySrcHash({
      id: 'main-entry-1',
      tmId: mainTmId,
      projectId: 0,
      srcLang: 'en',
      tgtLang: 'zh',
      srcHash,
      matchKey: 'hello',
      tagsSignature: '',
      sourceTokens: [{ type: 'text', content: 'Hello' }],
      targetTokens: matchedTokens,
      createdAt: now,
      updatedAt: now,
      usageCount: 1
    });
    db.replaceTMFts(mainTmId, 'Hello', '你好', entryId);

    const projectRepo = new SqliteProjectRepository(db);
    const segmentRepo = new SqliteSegmentRepository(db);
    const tmRepo = new SqliteTMRepository(db);
    const tx = new SqliteTransactionManager(db);
    const tmService = new TMService(projectRepo, tmRepo);
    const segmentService = new SegmentService(segmentRepo, tmService, tx);
    const module = new TMModule(projectRepo, segmentRepo, tmRepo, tx, tmService, segmentService, ':memory:', vi.fn());

    const eventSpy = vi.fn();
    segmentService.on('segments-updated', eventSpy);

    const result = await module.batchMatchFileWithTM(fileId, mainTmId);

    expect(result).toEqual({
      total: 3,
      matched: 2,
      applied: 2,
      skipped: 0
    });

    const seg1 = db.getSegment('seg-1');
    const seg2 = db.getSegment('seg-2');
    const seg3 = db.getSegment('seg-3');
    expect(seg1?.status).toBe('confirmed');
    expect(seg2?.status).toBe('confirmed');
    expect(seg3?.status).toBe('new');
    expect(seg1?.targetTokens).toEqual(matchedTokens);
    expect(seg2?.targetTokens).toEqual(matchedTokens);

    const workingTM = db.getProjectMountedTMs(projectId).find(tm => tm.type === 'working');
    expect(workingTM).toBeDefined();
    if (!workingTM) {
      throw new Error('Expected working TM to exist');
    }
    const workingEntry = db.findTMEntryByHash(workingTM.id, srcHash);
    expect(workingEntry?.targetTokens).toEqual(matchedTokens);

    expect(eventSpy).toHaveBeenCalledTimes(2);
    const firstEvent = eventSpy.mock.calls[0][0];
    const secondEvent = eventSpy.mock.calls[1][0];
    expect(firstEvent).toMatchObject({
      segmentId: 'seg-1',
      status: 'confirmed',
      propagatedIds: ['seg-2']
    });
    expect(secondEvent).toMatchObject({
      segmentId: 'seg-2',
      status: 'confirmed',
      propagatedIds: []
    });
  });
});
