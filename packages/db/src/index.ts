import Database from 'better-sqlite3';
import { Project, ProjectFile, Segment, SegmentStatus, Token, TMEntry } from '@cat/core';
import { randomUUID } from 'crypto';

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

    // 3. Handle migration
    if (currentVersion < 3) {
      console.log(`[DB] Upgrading schema from v${currentVersion} to v3...`);
      
      this.db.transaction(() => {
        // 1. Create v3 Schema tables with temporary names
        this.db.exec(`
          CREATE TABLE projects_v3 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            srcLang TEXT NOT NULL,
            tgtLang TEXT NOT NULL,
            createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
          );

          CREATE TABLE files_v3 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT UNIQUE NOT NULL,
            projectId INTEGER NOT NULL,
            name TEXT NOT NULL,
            totalSegments INTEGER DEFAULT 0,
            confirmedSegments INTEGER DEFAULT 0,
            createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            FOREIGN KEY (projectId) REFERENCES projects_v3(id) ON DELETE CASCADE
          );

          CREATE TABLE segments_v3 (
            segmentId TEXT PRIMARY KEY,
            fileId INTEGER NOT NULL,
            orderIndex INTEGER NOT NULL,
            sourceTokensJson TEXT NOT NULL,
            targetTokensJson TEXT NOT NULL,
            status TEXT NOT NULL,
            tagsSignature TEXT NOT NULL,
            matchKey TEXT NOT NULL,
            srcHash TEXT NOT NULL,
            metaJson TEXT NOT NULL,
            updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            FOREIGN KEY (fileId) REFERENCES files_v3(id) ON DELETE CASCADE
          );

          CREATE TABLE tm_entries (
            id TEXT PRIMARY KEY,
            projectId INTEGER NOT NULL,
            srcLang TEXT NOT NULL,
            tgtLang TEXT NOT NULL,
            srcHash TEXT NOT NULL,
            matchKey TEXT NOT NULL,
            tagsSignature TEXT NOT NULL,
            sourceTokensJson TEXT NOT NULL,
            targetTokensJson TEXT NOT NULL,
            originSegmentId TEXT,
            createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            usageCount INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (projectId) REFERENCES projects_v3(id) ON DELETE CASCADE
          );

          CREATE VIRTUAL TABLE tm_fts USING fts5(
            projectId UNINDEXED,
            srcText,
            tgtText,
            tmEntryId UNINDEXED
          );
        `);

        // 2. Copy data if old tables exist
        const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
        const hasOldProjects = tables.some(t => t.name === 'projects');
        const hasOldFiles = tables.some(t => t.name === 'files');
        const hasOldSegments = tables.some(t => t.name === 'segments');

        if (hasOldProjects) {
          const oldProjects = this.db.prepare('SELECT * FROM projects').all() as any[];
          for (const p of oldProjects) {
            this.db.prepare('INSERT INTO projects_v3 (id, uuid, name, srcLang, tgtLang, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
              .run(p.id, randomUUID(), p.name, p.srcLang, p.tgtLang, p.createdAt || new Date().toISOString(), p.updatedAt || new Date().toISOString());
          }
        }

        if (hasOldFiles) {
          const oldFiles = this.db.prepare('SELECT * FROM files').all() as any[];
          for (const f of oldFiles) {
            this.db.prepare('INSERT INTO files_v3 (id, uuid, projectId, name, totalSegments, confirmedSegments, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
              .run(f.id, randomUUID(), f.projectId, f.name, f.totalSegments, f.confirmedSegments, f.createdAt || new Date().toISOString(), f.updatedAt || new Date().toISOString());
          }
        }

        if (hasOldSegments) {
          const oldSegments = this.db.prepare('SELECT * FROM segments').all() as any[];
          for (const s of oldSegments) {
            this.db.prepare('INSERT INTO segments_v3 (segmentId, fileId, orderIndex, sourceTokensJson, targetTokensJson, status, tagsSignature, matchKey, srcHash, metaJson, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
              .run(s.segmentId, s.fileId, s.orderIndex, s.sourceTokensJson, s.targetTokensJson, s.status, s.tagsSignature, s.matchKey, s.srcHash, s.metaJson, s.updatedAt || new Date().toISOString());
          }
        }

        // 3. Drop old and rename new
        this.db.exec(`
          DROP TABLE IF EXISTS segments;
          DROP TABLE IF EXISTS files;
          DROP TABLE IF EXISTS projects;
          
          ALTER TABLE projects_v3 RENAME TO projects;
          ALTER TABLE files_v3 RENAME TO files;
          ALTER TABLE segments_v3 RENAME TO segments;

          -- Indices
          CREATE INDEX idx_files_project ON files(projectId);
          CREATE INDEX idx_segments_file_order ON segments(fileId, orderIndex);
          CREATE INDEX idx_segments_file_srcHash ON segments(fileId, srcHash);
          CREATE INDEX idx_tm_project_srcHash ON tm_entries(projectId, srcHash);
          CREATE INDEX idx_tm_project_matchKey ON tm_entries(projectId, matchKey);
        `);

        // 4. Post-migration: Archive confirmed segments to working TM
        const confirmedSegments = this.db.prepare(`
          SELECT s.*, f.projectId, p.srcLang, p.tgtLang 
          FROM segments s
          JOIN files f ON s.fileId = f.id
          JOIN projects p ON f.projectId = p.id
          WHERE s.status = 'confirmed'
        `).all() as any[];

        for (const s of confirmedSegments) {
          this.upsertTMEntry({
            id: randomUUID(),
            projectId: s.projectId,
            srcLang: s.srcLang,
            tgtLang: s.tgtLang,
            srcHash: s.srcHash,
            matchKey: s.matchKey,
            tagsSignature: s.tagsSignature,
            sourceTokens: JSON.parse(s.sourceTokensJson),
            targetTokens: JSON.parse(s.targetTokensJson),
            originSegmentId: s.segmentId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            usageCount: 1
          });
        }

        if (!versionRow) {
          this.db.prepare('INSERT INTO schema_version (version) VALUES (3)').run();
        } else {
          this.db.prepare('UPDATE schema_version SET version = 3').run();
        }
      })();
    }
  }

  // Project Repo
  public createProject(name: string, srcLang: string, tgtLang: string): number {
    console.log(`[DB] Creating project: ${name} (${srcLang} -> ${tgtLang})`);
    const result = this.db.prepare(
      'INSERT INTO projects (uuid, name, srcLang, tgtLang) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), name, srcLang, tgtLang);
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
      'INSERT INTO files (uuid, projectId, name) VALUES (?, ?, ?)'
    ).run(randomUUID(), projectId, name);
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

    this.db.prepare("UPDATE files SET totalSegments = ?, confirmedSegments = ?, updatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = ?")
      .run(stats.total, stats.confirmed, fileId);
  }

  // Segment Repo
  public bulkInsertSegments(segments: Segment[]) {
    console.log(`[DB] Bulk inserting ${segments.length} segments`);
    const insert = this.db.prepare(`
      INSERT INTO segments (
        segmentId, fileId, orderIndex, sourceTokensJson, targetTokensJson, 
        status, tagsSignature, matchKey, srcHash, metaJson
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((segs: Segment[]) => {
      for (const seg of segs) {
        insert.run(
          seg.segmentId,
          seg.fileId,
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

  public getSegment(segmentId: string): Segment | undefined {
    const row = this.db.prepare('SELECT * FROM segments WHERE segmentId = ?').get(segmentId) as any;
    if (!row) return undefined;

    return {
      segmentId: row.segmentId,
      fileId: row.fileId,
      orderIndex: row.orderIndex,
      sourceTokens: JSON.parse(row.sourceTokensJson),
      targetTokens: JSON.parse(row.targetTokensJson),
      status: row.status as SegmentStatus,
      tagsSignature: row.tagsSignature,
      matchKey: row.matchKey,
      srcHash: row.srcHash,
      meta: JSON.parse(row.metaJson)
    };
  }

  public getProjectIdByFileId(fileId: number): number | undefined {
    const row = this.db.prepare('SELECT projectId FROM files WHERE id = ?').get(fileId) as { projectId: number } | undefined;
    return row?.projectId;
  }

  public updateSegmentTarget(segmentId: string, targetTokens: Token[], status: SegmentStatus) {
    this.db.prepare("UPDATE segments SET targetTokensJson = ?, status = ?, updatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE segmentId = ?")
      .run(JSON.stringify(targetTokens), status, segmentId);

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
      JOIN files ON segments.fileId = files.id
      WHERE files.projectId = ? 
      GROUP BY status
    `).all(projectId) as { status: string, count: number }[];
  }

  // TM Repo
  public upsertTMEntry(entry: TMEntry) {
    this.db.prepare(`
      INSERT INTO tm_entries (
        id, projectId, srcLang, tgtLang, srcHash, matchKey, tagsSignature,
        sourceTokensJson, targetTokensJson, originSegmentId, usageCount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        targetTokensJson = excluded.targetTokensJson,
        updatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        usageCount = usageCount + 1
    `).run(
      entry.id,
      entry.projectId,
      entry.srcLang,
      entry.tgtLang,
      entry.srcHash,
      entry.matchKey,
      entry.tagsSignature,
      JSON.stringify(entry.sourceTokens),
      JSON.stringify(entry.targetTokens),
      entry.originSegmentId,
      entry.usageCount
    );

    // Update FTS
    const srcText = entry.sourceTokens.map(t => t.content).join('');
    const tgtText = entry.targetTokens.map(t => t.content).join('');
    
    // Simple FTS update: delete old and insert new
    this.db.prepare('DELETE FROM tm_fts WHERE tmEntryId = ?').run(entry.id);
    this.db.prepare('INSERT INTO tm_fts (projectId, srcText, tgtText, tmEntryId) VALUES (?, ?, ?, ?)')
      .run(entry.projectId, srcText, tgtText, entry.id);
  }

  public findTMEntryByHash(projectId: number, srcHash: string): TMEntry | undefined {
    const row = this.db.prepare('SELECT * FROM tm_entries WHERE projectId = ? AND srcHash = ?')
      .get(projectId, srcHash) as any;
    
    if (!row) return undefined;
    
    return {
      ...row,
      sourceTokens: JSON.parse(row.sourceTokensJson),
      targetTokens: JSON.parse(row.targetTokensJson)
    };
  }
}
