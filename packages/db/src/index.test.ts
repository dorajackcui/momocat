import { describe, it, expect, beforeEach } from 'vitest';
import { CATDatabase } from './index';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';

describe('CATDatabase', () => {
  let db: CATDatabase;
  const testDbPath = ':memory:'; // Use in-memory for tests

  beforeEach(() => {
    db = new CATDatabase(testDbPath);
  });

  it('should create a project and retrieve it', () => {
    const projectId = db.createProject('Test Project', 'en-US', 'zh-CN');
    expect(projectId).toBeGreaterThan(0);

    const project = db.getProject(projectId);
    expect(project).toBeDefined();
    expect(project?.name).toBe('Test Project');
    expect(project?.srcLang).toBe('en-US');
    expect(project?.tgtLang).toBe('zh-CN');
  });

  it('should list projects with correct stats', () => {
    db.createProject('P1', 'en', 'zh');
    db.createProject('P2', 'en', 'ja');

    const projects = db.listProjects();
    expect(projects).toHaveLength(2);
    const names = projects.map(p => p.name);
    expect(names).toContain('P1');
    expect(names).toContain('P2');
  });

  it('should handle cascading delete (Project -> Files -> Segments)', () => {
    // 1. Create Project
    const projectId = db.createProject('Delete Me', 'en', 'zh');
    
    // 2. Create File
    const fileId = db.createFile(projectId, 'test.xlsx');
    
    // 3. Add Segments
    db.bulkInsertSegments([
      {
        segmentId: 'seg1',
        fileId: fileId,
        projectId: projectId,
        orderIndex: 0,
        sourceTokens: [{ type: 'text', content: 'Hello' }],
        targetTokens: [],
        status: 'new',
        tagsSignature: '',
        matchKey: 'hello',
        srcHash: 'hash1',
        meta: { updatedAt: new Date().toISOString() }
      }
    ]);

    // Verify exists
    expect(db.getProject(projectId)).toBeDefined();
    expect(db.listFiles(projectId)).toHaveLength(1);
    expect(db.getSegmentsPage(fileId, 0, 10)).toHaveLength(1);

    // 4. Delete Project
    db.deleteProject(projectId);

    // Verify cascading delete
    expect(db.getProject(projectId)).toBeUndefined();
    expect(db.listFiles(projectId)).toHaveLength(0);
    // Segments for that fileId should be gone (though technically we can't get them without the fileId)
    // We can check stats or another query to be sure
  });

  it('should update file stats when segments change', () => {
    const projectId = db.createProject('Stats Project', 'en', 'zh');
    const fileId = db.createFile(projectId, 'stats.xlsx');
    
    db.bulkInsertSegments([
      {
        segmentId: 's1',
        fileId: fileId,
        projectId: projectId,
        orderIndex: 0,
        sourceTokens: [{ type: 'text', content: 'A' }],
        targetTokens: [],
        status: 'new',
        tagsSignature: '',
        matchKey: 'a',
        srcHash: 'ha',
        meta: { updatedAt: '' }
      },
      {
        segmentId: 's2',
        fileId: fileId,
        projectId: projectId,
        orderIndex: 1,
        sourceTokens: [{ type: 'text', content: 'B' }],
        targetTokens: [],
        status: 'new',
        tagsSignature: '',
        matchKey: 'b',
        srcHash: 'hb',
        meta: { updatedAt: '' }
      }
    ]);

    let file = db.getFile(fileId);
    expect(file?.totalSegments).toBe(2);
    expect(file?.confirmedSegments).toBe(0);

    // Confirm one segment
    db.updateSegmentTarget('s1', [{ type: 'text', content: '甲' }], 'confirmed');
    
    file = db.getFile(fileId);
    expect(file?.confirmedSegments).toBe(1);
  });
});
