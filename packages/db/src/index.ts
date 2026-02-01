import Database from 'better-sqlite3';
import { Project, ProjectFile, Segment, SegmentStatus, Token } from '@cat/core';

export class CATDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('foreign_keys = ON');
    this.init();
  }

  private init() {
    // 1. Ensure version table exists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );
    `);

    // 2. Check version
    const versionRow = this.db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined;
    const currentVersion = versionRow ? versionRow.version : 0;

    // 3. Handle migration/re-init
    if (currentVersion < 2) {
      console.log(`[DB] Upgrading schema from v${currentVersion} to v2...`);
      // For development, we drop and recreate
      this.db.exec(`
        DROP TABLE IF EXISTS segments;
        DROP TABLE IF EXISTS files;
        DROP TABLE IF EXISTS projects;
      `);
      
      if (!versionRow) {
        this.db.prepare('INSERT INTO schema_version (version) VALUES (2)').run();
      } else {
        this.db.prepare('UPDATE schema_version SET version = 2').run();
      }
    }

    // 4. Create current schema
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        srcLang TEXT NOT NULL,
        tgtLang TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        projectId INTEGER NOT NULL,
        name TEXT NOT NULL,
        totalSegments INTEGER DEFAULT 0,
        confirmedSegments INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS segments (
        segmentId TEXT PRIMARY KEY,
        fileId INTEGER NOT NULL,
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
        FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE CASCADE,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_segment_file_order ON segments(fileId, orderIndex);
      CREATE INDEX IF NOT EXISTS idx_segment_file_srcHash ON segments(fileId, srcHash);
      CREATE INDEX IF NOT EXISTS idx_file_project ON files(projectId);
    `);
  }

  // Project Repo
  public createProject(name: string, srcLang: string, tgtLang: string): number {
    console.log(`[DB] Creating project: ${name} (${srcLang} -> ${tgtLang})`);
    const result = this.db.prepare(
      'INSERT INTO projects (name, srcLang, tgtLang) VALUES (?, ?, ?)'
    ).run(name, srcLang, tgtLang);
    return result.lastInsertRowid as number;
  }

  public listProjects(): (Project & { progress: number; fileCount: number })[] {
    console.log('[DB] Listing projects');
    const projects = this.db.prepare('SELECT * FROM projects ORDER BY updatedAt DESC').all() as Project[];
    return projects.map(p => {
      const stats = this.getProjectStats(p.id);
      const fileCount = this.db.prepare('SELECT COUNT(*) as count FROM files WHERE projectId = ?').get(p.id) as { count: number };
      
      const total = stats.reduce((sum, s) => sum + s.count, 0);
      const confirmed = stats.find(s => s.status === 'confirmed')?.count || 0;
      const progress = total === 0 ? 0 : Math.round((confirmed / total) * 100);
      
      return { ...p, progress, fileCount: fileCount.count };
    });
  }

  public getProject(id: number): Project | undefined {
    return this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
  }

  public deleteProject(id: number) {
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  }

  // File Repo
  public createFile(projectId: number, name: string): number {
    const result = this.db.prepare(
      'INSERT INTO files (projectId, name) VALUES (?, ?)'
    ).run(projectId, name);
    return result.lastInsertRowid as number;
  }

  public listFiles(projectId: number): ProjectFile[] {
    return this.db.prepare('SELECT * FROM files WHERE projectId = ? ORDER BY createdAt DESC').all(projectId) as ProjectFile[];
  }

  public getFile(id: number): ProjectFile | undefined {
    return this.db.prepare('SELECT * FROM files WHERE id = ?').get(id) as ProjectFile | undefined;
  }

  public deleteFile(id: number) {
    this.db.prepare('DELETE FROM files WHERE id = ?').run(id);
  }

  public updateFileStats(fileId: number) {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed
      FROM segments 
      WHERE fileId = ?
    `).get(fileId) as { total: number, confirmed: number };

    this.db.prepare('UPDATE files SET totalSegments = ?, confirmedSegments = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?')
      .run(stats.total, stats.confirmed, fileId);
  }

  // Segment Repo
  public bulkInsertSegments(segments: Segment[]) {
    console.log(`[DB] Bulk inserting ${segments.length} segments`);
    const insert = this.db.prepare(`
      INSERT INTO segments (
        segmentId, fileId, projectId, orderIndex, sourceTokensJson, targetTokensJson, 
        status, tagsSignature, matchKey, srcHash, metaJson
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((segs: Segment[]) => {
      for (const seg of segs) {
        insert.run(
          seg.segmentId,
          seg.fileId,
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
    
    if (segments.length > 0) {
      this.updateFileStats(segments[0].fileId);
    }
  }

  public getSegmentsPage(fileId: number, offset: number, limit: number): Segment[] {
    const rows = this.db.prepare(`
      SELECT * FROM segments 
      WHERE fileId = ? 
      ORDER BY orderIndex ASC 
      LIMIT ? OFFSET ?
    `).all(fileId, limit, offset) as any[];

    return rows.map(row => ({
      segmentId: row.segmentId,
      fileId: row.fileId,
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

    // Update file stats
    const seg = this.db.prepare('SELECT fileId FROM segments WHERE segmentId = ?').get(segmentId) as { fileId: number };
    if (seg) {
      this.updateFileStats(seg.fileId);
    }
  }

  public getProjectStats(projectId: number): { status: string, count: number }[] {
    return this.db.prepare(`
      SELECT 
        status, COUNT(*) as count 
      FROM segments 
      WHERE projectId = ? 
      GROUP BY status
    `).all(projectId) as { status: string, count: number }[];
  }
}
