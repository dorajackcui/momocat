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

  it('should update project AI settings', () => {
    const projectId = db.createProject('AI Settings Project', 'en-US', 'zh-CN');
    db.updateProjectAISettings(projectId, 'Keep product names untranslated.', 0.7);

    const project = db.getProject(projectId);
    expect(project?.aiPrompt).toBe('Keep product names untranslated.');
    expect(project?.aiTemperature).toBe(0.7);
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

  describe('Multi-TM Architecture (v5)', () => {
    it('should automatically create and mount a Working TM when a project is created', () => {
      const projectId = db.createProject('Auto TM Project', 'en', 'zh');
      const mounted = db.getProjectMountedTMs(projectId);
      
      expect(mounted).toHaveLength(1);
      expect(mounted[0].type).toBe('working');
      expect(mounted[0].name).toBe('Auto TM Project (Working TM)');
      expect(mounted[0].permission).toBe('readwrite');
    });

    it('should allow creating and mounting a Main TM', () => {
      const projectId = db.createProject('Main TM Project', 'en', 'zh');
      const tmId = db.createTM('Global Main TM', 'en', 'zh', 'main');
      
      db.mountTMToProject(projectId, tmId, 10, 'read');
      
      const mounted = db.getProjectMountedTMs(projectId);
      expect(mounted).toHaveLength(2);
      
      const mainTM = mounted.find(m => m.type === 'main');
      expect(mainTM).toBeDefined();
      expect(mainTM.name).toBe('Global Main TM');
      expect(mainTM.permission).toBe('read');
    });

    it('should search concordance across multiple mounted TMs', () => {
      const projectId = db.createProject('Concordance Project', 'en', 'zh');
      const mounted = db.getProjectMountedTMs(projectId);
      const workingTmId = mounted[0].id;
      
      const mainTmId = db.createTM('Main Asset', 'en', 'zh', 'main');
      db.mountTMToProject(projectId, mainTmId, 10, 'read');

      // Insert into Working TM
      db.upsertTMEntry({
        id: 'e1',
        tmId: workingTmId,
        srcHash: 'h1',
        matchKey: 'hello',
        tagsSignature: '',
        sourceTokens: [{ type: 'text', content: 'Hello' }],
        targetTokens: [{ type: 'text', content: '你好' }],
        usageCount: 1
      } as any);

      // Insert into Main TM
      db.upsertTMEntry({
        id: 'e2',
        tmId: mainTmId,
        srcHash: 'h2',
        matchKey: 'world',
        tagsSignature: '',
        sourceTokens: [{ type: 'text', content: 'World' }],
        targetTokens: [{ type: 'text', content: '世界' }],
        usageCount: 1
      } as any);

      const results = db.searchConcordance(projectId, 'hello');
      expect(results).toHaveLength(1);
      expect(results[0].srcHash).toBe('h1');

      const allResults = db.searchConcordance(projectId, 'world');
      expect(allResults).toHaveLength(1);
      expect(allResults[0].srcHash).toBe('h2');
    });
  });

  describe('Term Base System (v10)', () => {
    it('should create and mount term base to project', () => {
      const projectId = db.createProject('TB Project', 'en', 'zh');
      const tbId = db.createTermBase('Product Terms', 'en', 'zh');

      db.mountTermBaseToProject(projectId, tbId, 5);

      const mounted = db.getProjectMountedTermBases(projectId);
      expect(mounted).toHaveLength(1);
      expect(mounted[0].id).toBe(tbId);
      expect(mounted[0].name).toBe('Product Terms');
    });

    it('should insert and upsert term entries by normalized source term', () => {
      const tbId = db.createTermBase('Glossary', 'en', 'zh');

      const firstInsert = db.insertTBEntryIfAbsentBySrcTerm({
        id: 'tb-e1',
        tbId,
        srcTerm: 'Power Supply',
        tgtTerm: '电源'
      });
      expect(firstInsert).toBe('tb-e1');

      const duplicateInsert = db.insertTBEntryIfAbsentBySrcTerm({
        id: 'tb-e2',
        tbId,
        srcTerm: ' power   supply ',
        tgtTerm: '供电'
      });
      expect(duplicateInsert).toBeUndefined();

      const upserted = db.upsertTBEntryBySrcTerm({
        id: 'tb-e3',
        tbId,
        srcTerm: 'Power Supply',
        tgtTerm: '供电模块'
      });
      expect(upserted).toBe('tb-e1');

      const entries = db.listTBEntries(tbId, 20, 0);
      expect(entries).toHaveLength(1);
      expect(entries[0].srcNorm).toBe('power supply');
      expect(entries[0].tgtTerm).toBe('供电模块');
    });
  });
});
