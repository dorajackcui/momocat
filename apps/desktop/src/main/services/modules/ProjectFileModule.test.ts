import { describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Segment } from '@cat/core';
import { ProjectFileModule } from './ProjectFileModule';
import { ProjectRepository, SegmentRepository, SpreadsheetGateway } from '../ports';

describe('ProjectFileModule.addFileToProject cleanup', () => {
  it('removes db file record and copied file when import fails', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'project-file-module-'));
    const inputPath = join(rootDir, 'input.xlsx');
    writeFileSync(inputPath, 'fake spreadsheet');

    const createdFileId = 42;
    const projectRepo = {
      getProject: vi.fn().mockReturnValue({ id: 1 }),
      createFile: vi.fn().mockReturnValue(createdFileId),
      deleteFile: vi.fn(),
      getFile: vi.fn()
    } as unknown as ProjectRepository;

    const segmentRepo = {
      bulkInsertSegments: vi.fn()
    } as unknown as SegmentRepository;

    const filter = {
      import: vi.fn().mockRejectedValue(new Error('Import failed')),
      export: vi.fn(),
      getPreview: vi.fn()
    } as unknown as SpreadsheetGateway;

    const module = new ProjectFileModule(projectRepo, segmentRepo, filter, rootDir);
    const options = {
      hasHeader: true,
      sourceCol: 0,
      targetCol: 1
    };

    try {
      await expect(module.addFileToProject(1, inputPath, options)).rejects.toThrow('Import failed');
      expect(projectRepo.deleteFile).toHaveBeenCalledTimes(1);
      expect(projectRepo.deleteFile).toHaveBeenCalledWith(createdFileId);
      expect(segmentRepo.bulkInsertSegments).not.toHaveBeenCalled();

      const copiedPath = join(rootDir, '1', `${createdFileId}_input.xlsx`);
      expect(existsSync(copiedPath)).toBe(false);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('removes db file record and copied file when segment persistence fails', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'project-file-module-'));
    const inputPath = join(rootDir, 'input.xlsx');
    writeFileSync(inputPath, 'fake spreadsheet');

    const createdFileId = 43;
    const projectRepo = {
      getProject: vi.fn().mockReturnValue({ id: 1 }),
      createFile: vi.fn().mockReturnValue(createdFileId),
      deleteFile: vi.fn(),
      getFile: vi.fn()
    } as unknown as ProjectRepository;

    const importedSegments: Segment[] = [
      {
        segmentId: 'seg-1',
        fileId: createdFileId,
        orderIndex: 0,
        sourceTokens: [{ type: 'text', content: 'Hello' }],
        targetTokens: [],
        status: 'new',
        tagsSignature: '',
        matchKey: 'hello',
        srcHash: 'hash-1',
        meta: { updatedAt: new Date().toISOString() }
      }
    ];

    const segmentRepo = {
      bulkInsertSegments: vi.fn().mockImplementation(() => {
        throw new Error('Insert failed');
      })
    } as unknown as SegmentRepository;

    const filter = {
      import: vi.fn().mockResolvedValue(importedSegments),
      export: vi.fn(),
      getPreview: vi.fn()
    } as unknown as SpreadsheetGateway;

    const module = new ProjectFileModule(projectRepo, segmentRepo, filter, rootDir);
    const options = {
      hasHeader: true,
      sourceCol: 0,
      targetCol: 1
    };

    try {
      await expect(module.addFileToProject(1, inputPath, options)).rejects.toThrow('Insert failed');
      expect(projectRepo.deleteFile).toHaveBeenCalledTimes(1);
      expect(projectRepo.deleteFile).toHaveBeenCalledWith(createdFileId);
      expect(segmentRepo.bulkInsertSegments).toHaveBeenCalledTimes(1);

      const copiedPath = join(rootDir, '1', `${createdFileId}_input.xlsx`);
      expect(existsSync(copiedPath)).toBe(false);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
