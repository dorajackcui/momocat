import Database from 'better-sqlite3';
import { Project, Segment, SegmentStatus, Token } from '@cat/core';

export class CATDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        srcLang TEXT NOT NULL,
        tgtLang TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS segments (
        segmentId TEXT PRIMARY KEY,
        projectId INTEGER NOT NULL,
        orderIndex INTEGER NOT NULL,
        sourceTokensJson TEXT NOT NULL,
        targetTokensJson TEXT NOT NULL,
        status TEXT NOT NULL,
        tagsSignature TEXT NOT NULL,
        matchKey TEXT NOT NULL,
        srcHash TEXT NOT NULL,
        metaJson TEXT NOT NULL,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_segment_project_order ON segments(projectId, orderIndex);
      CREATE INDEX IF NOT EXISTS idx_segment_project_srcHash ON segments(projectId, srcHash);
    `);

    // Initial version if empty
    const version = this.db.prepare('SELECT version FROM schema_version').get();
    if (!version) {
      this.db.prepare('INSERT INTO schema_version (version) VALUES (1)').run();
    }
  }

  // Project Repo
  public createProject(name: string, srcLang: string, tgtLang: string): number {
    console.log(`[DB] Creating project: ${name} (${srcLang} -> ${tgtLang})`);
    const result = this.db.prepare(
      'INSERT INTO projects (name, srcLang, tgtLang) VALUES (?, ?, ?)'
    ).run(name, srcLang, tgtLang);
    return result.lastInsertRowid as number;
  }

  public listProjects(): (Project & { progress: number })[] {
    console.log('[DB] Listing projects');
    const projects = this.db.prepare('SELECT * FROM projects ORDER BY updatedAt DESC').all() as Project[];
    return projects.map(p => {
      const stats = this.getProjectStats(p.id) as { status: string, count: number }[];
      const total = stats.reduce((sum, s) => sum + s.count, 0);
      const confirmed = stats.find(s => s.status === 'confirmed')?.count || 0;
      const progress = total === 0 ? 0 : Math.round((confirmed / total) * 100);
      return { ...p, progress };
    });
  }

  public getProject(id: number): Project | undefined {
    return this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
  }

  // Segment Repo
  public bulkInsertSegments(segments: Segment[]) {
    console.log(`[DB] Bulk inserting ${segments.length} segments`);
    const insert = this.db.prepare(`
      INSERT INTO segments (
        segmentId, projectId, orderIndex, sourceTokensJson, targetTokensJson, 
        status, tagsSignature, matchKey, srcHash, metaJson
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((segs: Segment[]) => {
      for (const seg of segs) {
        insert.run(
          seg.segmentId,
          seg.projectId,
          seg.orderIndex,
          JSON.stringify(seg.sourceTokens),
          JSON.stringify(seg.targetTokens),
          seg.status,
          seg.tagsSignature,
          seg.matchKey,
          seg.srcHash,
          JSON.stringify(seg.meta)
        );
      }
    });

    transaction(segments);
  }

  public getSegmentsPage(projectId: number, offset: number, limit: number): Segment[] {
    const rows = this.db.prepare(`
      SELECT * FROM segments 
      WHERE projectId = ? 
      ORDER BY orderIndex ASC 
      LIMIT ? OFFSET ?
    `).all(projectId, limit, offset) as any[];

    return rows.map(row => ({
      segmentId: row.segmentId,
      projectId: row.projectId,
      orderIndex: row.orderIndex,
      sourceTokens: JSON.parse(row.sourceTokensJson),
      targetTokens: JSON.parse(row.targetTokensJson),
      status: row.status as SegmentStatus,
      tagsSignature: row.tagsSignature,
      matchKey: row.matchKey,
      srcHash: row.srcHash,
      meta: JSON.parse(row.metaJson)
    }));
  }

  public updateSegmentTarget(segmentId: string, targetTokens: Token[], status: SegmentStatus) {
    this.db.prepare(`
      UPDATE segments 
      SET targetTokensJson = ?, status = ?, updatedAt = CURRENT_TIMESTAMP 
      WHERE segmentId = ?
    `).run(JSON.stringify(targetTokens), status, segmentId);
  }

  public getProjectStats(projectId: number) {
    return this.db.prepare(`
      SELECT 
        status, COUNT(*) as count 
      FROM segments 
      WHERE projectId = ? 
      GROUP BY status
    `).all(projectId);
  }
}
