import Database from 'better-sqlite3';
import { Project, ProjectFile, Segment, SegmentStatus, Token, TMEntry, TBEntry } from '@cat/core';
import { randomUUID } from 'crypto';

export class CATDatabase {
  private db: Database.Database;
  private stmtUpsertTMEntry!: Database.Statement;
  private stmtInsertTMEntryIfAbsentBySrcHash!: Database.Statement;
  private stmtUpsertTMEntryBySrcHash!: Database.Statement;
  private stmtDeleteTMFtsByEntryId!: Database.Statement;
  private stmtInsertTMFts!: Database.Statement;
  private stmtFindTMEntryByHash!: Database.Statement;
  private stmtFindTMEntryMetaByHash!: Database.Statement;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('temp_store = MEMORY');
    this.init();
    this.prepareStatements();
  }

  private prepareStatements() {
    this.stmtUpsertTMEntry = this.db.prepare(`
      INSERT INTO tm_entries (
        id, tmId, srcHash, matchKey, tagsSignature,
        sourceTokensJson, targetTokensJson, originSegmentId, usageCount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        targetTokensJson = excluded.targetTokensJson,
        updatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        usageCount = usageCount + 1
    `);

    this.stmtInsertTMEntryIfAbsentBySrcHash = this.db.prepare(`
      INSERT INTO tm_entries (
        id, tmId, srcHash, matchKey, tagsSignature,
        sourceTokensJson, targetTokensJson, originSegmentId, usageCount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tmId, srcHash) DO NOTHING
      RETURNING id
    `);

    this.stmtUpsertTMEntryBySrcHash = this.db.prepare(`
      INSERT INTO tm_entries (
        id, tmId, srcHash, matchKey, tagsSignature,
        sourceTokensJson, targetTokensJson, originSegmentId, usageCount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tmId, srcHash) DO UPDATE SET
        matchKey = excluded.matchKey,
        tagsSignature = excluded.tagsSignature,
        sourceTokensJson = excluded.sourceTokensJson,
        targetTokensJson = excluded.targetTokensJson,
        originSegmentId = excluded.originSegmentId,
        updatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        usageCount = tm_entries.usageCount + 1
      RETURNING id
    `);

    this.stmtDeleteTMFtsByEntryId = this.db.prepare('DELETE FROM tm_fts WHERE tmEntryId = ?');
    this.stmtInsertTMFts = this.db.prepare(
      'INSERT INTO tm_fts (tmId, srcText, tgtText, tmEntryId) VALUES (?, ?, ?, ?)'
    );
    this.stmtFindTMEntryByHash = this.db.prepare('SELECT * FROM tm_entries WHERE tmId = ? AND srcHash = ?');
    this.stmtFindTMEntryMetaByHash = this.db.prepare(
      'SELECT id, usageCount, createdAt FROM tm_entries WHERE tmId = ? AND srcHash = ?'
    );
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
            updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
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
            updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
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
            usageCount INTEGER NOT NULL DEFAULT 0
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
          // Note: In v5 migration, we don't have tmId yet here easily.
          // But since we are migrating TO v5, we should probably skip this v3-style call
          // or handle it after v5 tables are ready.
          // For safety in migration, let's just use the v5 logic inside the migration loop below.
        }

        if (!versionRow) {
          this.db.prepare('INSERT INTO schema_version (version) VALUES (3)').run();
        } else {
          this.db.prepare('UPDATE schema_version SET version = 3').run();
        }
      })();
    }

    if (currentVersion < 4) {
      console.log(`[DB] Upgrading schema to v4 (Adding importOptionsJson to files)...`);
      this.db.exec(`
        ALTER TABLE files ADD COLUMN importOptionsJson TEXT;
      `);
    }

    if (currentVersion < 5) {
      console.log(`[DB] Upgrading schema to v5 (Multi-TM Architecture)...`);
      this.db.transaction(() => {
        // 1. Create new TM related tables
        this.db.exec(`
          CREATE TABLE tms (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            srcLang TEXT NOT NULL,
            tgtLang TEXT NOT NULL,
            type TEXT NOT NULL, -- 'working' | 'main'
            createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
          );

          CREATE TABLE project_tms (
            projectId INTEGER NOT NULL,
            tmId TEXT NOT NULL,
            priority INTEGER NOT NULL DEFAULT 0,
            permission TEXT NOT NULL DEFAULT 'read', -- 'read' | 'write' | 'readwrite'
            isEnabled INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY(projectId, tmId),
            FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (tmId) REFERENCES tms(id) ON DELETE CASCADE
          );

          -- Temporary table to restructure tm_entries
          CREATE TABLE tm_entries_v5 (
            id TEXT PRIMARY KEY,
            tmId TEXT NOT NULL,
            srcHash TEXT NOT NULL,
            matchKey TEXT NOT NULL,
            tagsSignature TEXT NOT NULL,
            sourceTokensJson TEXT NOT NULL,
            targetTokensJson TEXT NOT NULL,
            originSegmentId TEXT,
            createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            usageCount INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (tmId) REFERENCES tms(id) ON DELETE CASCADE
          );
        `);

        // 2. Migrate existing data
        const projects = this.db.prepare('SELECT * FROM projects').all() as any[];
        for (const p of projects) {
          const workingTmId = randomUUID();
          // Create a Working TM for each project
          this.db.prepare(`
            INSERT INTO tms (id, name, srcLang, tgtLang, type, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(workingTmId, `${p.name} (Working TM)`, p.srcLang, p.tgtLang, 'working', p.createdAt, p.updatedAt);

          // Bind project to its Working TM
          this.db.prepare(`
            INSERT INTO project_tms (projectId, tmId, priority, permission, isEnabled)
            VALUES (?, ?, ?, ?, ?)
          `).run(p.id, workingTmId, 0, 'readwrite', 1);

          // Migrate tm_entries for this project to its new Working TM
          const oldEntries = this.db.prepare('SELECT * FROM tm_entries WHERE projectId = ?').all(p.id) as any[];
          for (const e of oldEntries) {
            this.db.prepare(`
              INSERT INTO tm_entries_v5 (
                id, tmId, srcHash, matchKey, tagsSignature, 
                sourceTokensJson, targetTokensJson, originSegmentId, 
                createdAt, updatedAt, usageCount
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              e.id, workingTmId, e.srcHash, e.matchKey, e.tagsSignature,
              e.sourceTokensJson, e.targetTokensJson, e.originSegmentId,
              e.createdAt, e.updatedAt, e.usageCount
            );
          }
        }

        // 3. Swap tm_entries table
        this.db.exec(`
          DROP TABLE tm_entries;
          ALTER TABLE tm_entries_v5 RENAME TO tm_entries;

          -- Re-create indices
          CREATE INDEX idx_project_tms_project ON project_tms(projectId, isEnabled, priority);
          CREATE INDEX idx_tm_entries_tm_srcHash ON tm_entries(tmId, srcHash);
          CREATE INDEX idx_tm_entries_tm_matchKey ON tm_entries(tmId, matchKey);
        `);

        // 4. Update FTS table to use tmId instead of projectId
        this.db.exec(`
          DROP TABLE tm_fts;
          CREATE VIRTUAL TABLE tm_fts USING fts5(
            tmId UNINDEXED,
            srcText,
            tgtText,
            tmEntryId UNINDEXED
          );
        `);

        // Populate FTS from new tm_entries
        const allEntries = this.db.prepare('SELECT * FROM tm_entries').all() as any[];
        for (const e of allEntries) {
          const srcText = JSON.parse(e.sourceTokensJson).map((t: any) => t.content).join('');
          const tgtText = JSON.parse(e.targetTokensJson).map((t: any) => t.content).join('');
          this.db.prepare('INSERT INTO tm_fts (tmId, srcText, tgtText, tmEntryId) VALUES (?, ?, ?, ?)')
            .run(e.tmId, srcText, tgtText, e.id);
        }

        this.db.prepare('UPDATE schema_version SET version = 5').run();
      })();
    }

    if (currentVersion < 6) {
      console.log(`[DB] Upgrading schema to v6 (Fixing Foreign Keys for Files/Segments)...`);
      this.db.transaction(() => {
        // 1. Fix files table
        this.db.exec(`
          CREATE TABLE files_v6 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT UNIQUE NOT NULL,
            projectId INTEGER NOT NULL,
            name TEXT NOT NULL,
            totalSegments INTEGER DEFAULT 0,
            confirmedSegments INTEGER DEFAULT 0,
            importOptionsJson TEXT,
            createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
          );
          INSERT INTO files_v6 SELECT id, uuid, projectId, name, totalSegments, confirmedSegments, importOptionsJson, createdAt, updatedAt FROM files;
          DROP TABLE files;
          ALTER TABLE files_v6 RENAME TO files;
        `);

        // 2. Fix segments table
        this.db.exec(`
          CREATE TABLE segments_v6 (
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
            FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE CASCADE
          );
          INSERT INTO segments_v6 SELECT * FROM segments;
          DROP TABLE segments;
          ALTER TABLE segments_v6 RENAME TO segments;
        `);

        this.db.prepare('UPDATE schema_version SET version = 6').run();
      })();
    }

    if (currentVersion < 7) {
      console.log('[DB] Upgrading schema to v7 (AI prompt + app settings)...');
      this.db.transaction(() => {
        this.db.exec(`
          ALTER TABLE projects ADD COLUMN aiPrompt TEXT;

          CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
          );
        `);

        this.db.prepare('UPDATE schema_version SET version = 7').run();
      })();
    }

    if (currentVersion < 8) {
      console.log('[DB] Upgrading schema to v8 (TM unique srcHash per TM)...');
      this.db.transaction(() => {
        // Keep the newest row per (tmId, srcHash) before applying unique constraint.
        this.db.exec(`
          DELETE FROM tm_entries
          WHERE id IN (
            SELECT older.id
            FROM tm_entries older
            JOIN tm_entries newer
              ON older.tmId = newer.tmId
             AND older.srcHash = newer.srcHash
             AND (
               older.updatedAt < newer.updatedAt
               OR (older.updatedAt = newer.updatedAt AND older.id < newer.id)
             )
          );
        `);

        this.db.exec(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_tm_entries_tm_srcHash_unique
          ON tm_entries(tmId, srcHash);
        `);

        this.db.prepare('UPDATE schema_version SET version = 8').run();
      })();
    }

    if (currentVersion < 9) {
      console.log('[DB] Upgrading schema to v9 (Project AI temperature)...');
      this.db.transaction(() => {
        const columns = this.db.prepare('PRAGMA table_info(projects)').all() as Array<{ name: string }>;
        const hasAiTemperature = columns.some(column => column.name === 'aiTemperature');

        if (!hasAiTemperature) {
          this.db.exec(`
            ALTER TABLE projects ADD COLUMN aiTemperature REAL;
          `);
        }

        this.db.prepare('UPDATE schema_version SET version = 9').run();
      })();
    }

    if (currentVersion < 10) {
      console.log('[DB] Upgrading schema to v10 (Term Base system)...');
      this.db.transaction(() => {
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS term_bases (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            srcLang TEXT NOT NULL,
            tgtLang TEXT NOT NULL,
            createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
          );

          CREATE TABLE IF NOT EXISTS project_term_bases (
            projectId INTEGER NOT NULL,
            tbId TEXT NOT NULL,
            priority INTEGER NOT NULL DEFAULT 10,
            isEnabled INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY(projectId, tbId),
            FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (tbId) REFERENCES term_bases(id) ON DELETE CASCADE
          );

          CREATE TABLE IF NOT EXISTS tb_entries (
            id TEXT PRIMARY KEY,
            tbId TEXT NOT NULL,
            srcTerm TEXT NOT NULL,
            tgtTerm TEXT NOT NULL,
            srcNorm TEXT NOT NULL,
            note TEXT,
            createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            usageCount INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (tbId) REFERENCES term_bases(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_project_tbs_project
          ON project_term_bases(projectId, isEnabled, priority);

          CREATE INDEX IF NOT EXISTS idx_tb_entries_tb_src
          ON tb_entries(tbId, srcNorm);

          CREATE INDEX IF NOT EXISTS idx_tb_entries_tb_src_term
          ON tb_entries(tbId, srcTerm);

          CREATE UNIQUE INDEX IF NOT EXISTS idx_tb_entries_tb_src_unique
          ON tb_entries(tbId, srcNorm);
        `);

        this.db.prepare('UPDATE schema_version SET version = 10').run();
      })();
    }
  }

  // Project Repo
  public createProject(name: string, srcLang: string, tgtLang: string): number {
    console.log(`[DB] Creating project: ${name} (${srcLang} -> ${tgtLang})`);
    const result = this.db.prepare(
      'INSERT INTO projects (uuid, name, srcLang, tgtLang) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), name, srcLang, tgtLang);
    const projectId = result.lastInsertRowid as number;

    // V5: Auto-create and mount Working TM for new project
    const workingTmId = randomUUID();
    this.db.prepare(`
      INSERT INTO tms (id, name, srcLang, tgtLang, type)
      VALUES (?, ?, ?, ?, 'working')
    `).run(workingTmId, `${name} (Working TM)`, srcLang, tgtLang);

    this.db.prepare(`
      INSERT INTO project_tms (projectId, tmId, priority, permission, isEnabled)
      VALUES (?, ?, 0, 'readwrite', 1)
    `).run(projectId, workingTmId);

    return projectId;
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

  public updateProjectPrompt(projectId: number, aiPrompt: string | null) {
    this.db.prepare(
      "UPDATE projects SET aiPrompt = ?, updatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = ?"
    ).run(aiPrompt, projectId);
  }

  public updateProjectAISettings(projectId: number, aiPrompt: string | null, aiTemperature: number | null) {
    this.db.prepare(
      "UPDATE projects SET aiPrompt = ?, aiTemperature = ?, updatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = ?"
    ).run(aiPrompt, aiTemperature, projectId);
  }

  public deleteProject(id: number) {
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  }

  // File Repo
  public createFile(projectId: number, name: string, importOptionsJson?: string): number {
    const result = this.db.prepare(
      'INSERT INTO files (uuid, projectId, name, importOptionsJson) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), projectId, name, importOptionsJson || null);
    return result.lastInsertRowid as number;
  }

  public listFiles(projectId: number): ProjectFile[] {
    return this.db.prepare('SELECT * FROM files WHERE projectId = ? ORDER BY createdAt DESC').all(projectId) as ProjectFile[];
  }

  public getFile(id: number): (ProjectFile & { importOptionsJson?: string }) | undefined {
    return this.db.prepare('SELECT * FROM files WHERE id = ?').get(id) as (ProjectFile & { importOptionsJson?: string }) | undefined;
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
    };
  }

  public getProjectSegmentsByHash(projectId: number, srcHash: string): Segment[] {
    const rows = this.db.prepare(`
      SELECT segments.* 
      FROM segments 
      JOIN files ON segments.fileId = files.id 
      WHERE files.projectId = ? AND segments.srcHash = ?
    `).all(projectId, srcHash) as any[];

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

  public runInTransaction(fn: () => void) {
    this.db.transaction(fn)();
  }

  // App Settings
  public getSetting(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value?: string } | undefined;
    return row?.value;
  }

  public setSetting(key: string, value: string | null) {
    this.db.prepare(`
      INSERT INTO app_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).run(key, value);
  }

  // Term Base (TB) Management
  public listTermBases(): any[] {
    return this.db.prepare('SELECT * FROM term_bases ORDER BY updatedAt DESC').all();
  }

  public createTermBase(name: string, srcLang: string, tgtLang: string): string {
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO term_bases (id, name, srcLang, tgtLang)
      VALUES (?, ?, ?, ?)
    `).run(id, name, srcLang, tgtLang);
    return id;
  }

  public deleteTermBase(id: string) {
    this.db.prepare('DELETE FROM term_bases WHERE id = ?').run(id);
  }

  public getTermBase(tbId: string): any | undefined {
    return this.db.prepare('SELECT * FROM term_bases WHERE id = ?').get(tbId);
  }

  public getTermBaseStats(tbId: string) {
    const count = this.db.prepare('SELECT COUNT(*) as count FROM tb_entries WHERE tbId = ?').get(tbId) as { count: number };
    return { entryCount: count.count };
  }

  public mountTermBaseToProject(projectId: number, tbId: string, priority: number = 10) {
    this.db.prepare(`
      INSERT INTO project_term_bases (projectId, tbId, priority, isEnabled)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(projectId, tbId) DO UPDATE SET
        priority = excluded.priority,
        isEnabled = 1
    `).run(projectId, tbId, priority);
  }

  public unmountTermBaseFromProject(projectId: number, tbId: string) {
    this.db.prepare('DELETE FROM project_term_bases WHERE projectId = ? AND tbId = ?').run(projectId, tbId);
  }

  public getProjectMountedTermBases(projectId: number): any[] {
    return this.db.prepare(`
      SELECT term_bases.*, project_term_bases.priority, project_term_bases.isEnabled
      FROM project_term_bases
      JOIN term_bases ON project_term_bases.tbId = term_bases.id
      WHERE project_term_bases.projectId = ? AND project_term_bases.isEnabled = 1
      ORDER BY project_term_bases.priority ASC, term_bases.updatedAt DESC
    `).all(projectId);
  }

  public listTBEntries(tbId: string, limit: number = 500, offset: number = 0): TBEntry[] {
    const rows = this.db.prepare(`
      SELECT *
      FROM tb_entries
      WHERE tbId = ?
      ORDER BY srcTerm COLLATE NOCASE ASC
      LIMIT ? OFFSET ?
    `).all(tbId, limit, offset) as any[];

    return rows.map(row => ({ ...row })) as TBEntry[];
  }

  public listProjectTermEntries(projectId: number): Array<TBEntry & { tbName: string; priority: number }> {
    const rows = this.db.prepare(`
      SELECT tb_entries.*, term_bases.name as tbName, project_term_bases.priority
      FROM project_term_bases
      JOIN term_bases ON project_term_bases.tbId = term_bases.id
      JOIN tb_entries ON tb_entries.tbId = term_bases.id
      WHERE project_term_bases.projectId = ? AND project_term_bases.isEnabled = 1
      ORDER BY project_term_bases.priority ASC, length(tb_entries.srcTerm) DESC
      LIMIT 5000
    `).all(projectId) as any[];

    return rows.map(row => ({ ...row })) as Array<TBEntry & { tbName: string; priority: number }>;
  }

  public insertTBEntryIfAbsentBySrcTerm(params: {
    id: string;
    tbId: string;
    srcTerm: string;
    tgtTerm: string;
    note?: string | null;
    usageCount?: number;
  }): string | undefined {
    const srcNorm = this.normalizeTerm(params.srcTerm);
    const row = this.db.prepare(`
      INSERT INTO tb_entries (id, tbId, srcTerm, tgtTerm, srcNorm, note, usageCount)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tbId, srcNorm) DO NOTHING
      RETURNING id
    `).get(
      params.id,
      params.tbId,
      params.srcTerm.trim(),
      params.tgtTerm.trim(),
      srcNorm,
      params.note ?? null,
      params.usageCount ?? 0
    ) as { id: string } | undefined;

    if (row?.id) {
      this.db.prepare(`
        UPDATE term_bases
        SET updatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        WHERE id = ?
      `).run(params.tbId);
    }

    return row?.id;
  }

  public upsertTBEntryBySrcTerm(params: {
    id: string;
    tbId: string;
    srcTerm: string;
    tgtTerm: string;
    note?: string | null;
    usageCount?: number;
  }): string {
    const srcNorm = this.normalizeTerm(params.srcTerm);
    const row = this.db.prepare(`
      INSERT INTO tb_entries (id, tbId, srcTerm, tgtTerm, srcNorm, note, usageCount)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tbId, srcNorm) DO UPDATE SET
        srcTerm = excluded.srcTerm,
        tgtTerm = excluded.tgtTerm,
        note = excluded.note,
        updatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        usageCount = tb_entries.usageCount + 1
      RETURNING id
    `).get(
      params.id,
      params.tbId,
      params.srcTerm.trim(),
      params.tgtTerm.trim(),
      srcNorm,
      params.note ?? null,
      params.usageCount ?? 0
    ) as { id: string } | undefined;

    if (!row?.id) {
      throw new Error('Failed to upsert TB entry');
    }

    this.db.prepare(`
      UPDATE term_bases
      SET updatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      WHERE id = ?
    `).run(params.tbId);

    return row.id;
  }

  public incrementTBUsage(tbEntryId: string) {
    this.db.prepare(`
      UPDATE tb_entries
      SET usageCount = usageCount + 1,
          updatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      WHERE id = ?
    `).run(tbEntryId);
  }

  private normalizeTerm(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  public upsertTMEntry(entry: TMEntry & { tmId: string }) {
    this.stmtUpsertTMEntry.run(
      entry.id,
      entry.tmId,
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
    
    this.stmtDeleteTMFtsByEntryId.run(entry.id);
    this.stmtInsertTMFts.run(entry.tmId, srcText, tgtText, entry.id);
  }

  public insertTMEntryIfAbsentBySrcHash(entry: TMEntry & { tmId: string }): string | undefined {
    const row = this.stmtInsertTMEntryIfAbsentBySrcHash.get(
      entry.id,
      entry.tmId,
      entry.srcHash,
      entry.matchKey,
      entry.tagsSignature,
      JSON.stringify(entry.sourceTokens),
      JSON.stringify(entry.targetTokens),
      entry.originSegmentId,
      entry.usageCount
    ) as { id: string } | undefined;

    return row?.id;
  }

  public upsertTMEntryBySrcHash(entry: TMEntry & { tmId: string }): string {
    const row = this.stmtUpsertTMEntryBySrcHash.get(
      entry.id,
      entry.tmId,
      entry.srcHash,
      entry.matchKey,
      entry.tagsSignature,
      JSON.stringify(entry.sourceTokens),
      JSON.stringify(entry.targetTokens),
      entry.originSegmentId,
      entry.usageCount
    ) as { id: string } | undefined;

    if (!row?.id) {
      throw new Error('Failed to upsert TM entry by srcHash');
    }

    return row.id;
  }

  public insertTMFts(tmId: string, srcText: string, tgtText: string, tmEntryId: string) {
    this.stmtInsertTMFts.run(tmId, srcText, tgtText, tmEntryId);
  }

  public replaceTMFts(tmId: string, srcText: string, tgtText: string, tmEntryId: string) {
    this.stmtDeleteTMFtsByEntryId.run(tmEntryId);
    this.stmtInsertTMFts.run(tmId, srcText, tgtText, tmEntryId);
  }

  public findTMEntryByHash(tmId: string, srcHash: string): TMEntry | undefined {
    const row = this.stmtFindTMEntryByHash.get(tmId, srcHash) as any;
    
    if (!row) return undefined;
    
    return {
      ...row,
      sourceTokens: JSON.parse(row.sourceTokensJson),
      targetTokens: JSON.parse(row.targetTokensJson)
    };
  }

  public findTMEntryMetaByHash(
    tmId: string,
    srcHash: string
  ): { id: string; usageCount: number; createdAt: string } | undefined {
    const row = this.stmtFindTMEntryMetaByHash.get(tmId, srcHash) as
      | { id: string; usageCount: number; createdAt: string }
      | undefined;
    return row;
  }

  public getProjectMountedTMs(projectId: number) {
    return this.db.prepare(`
      SELECT tms.*, project_tms.priority, project_tms.permission, project_tms.isEnabled
      FROM project_tms
      JOIN tms ON project_tms.tmId = tms.id
      WHERE project_tms.projectId = ? AND project_tms.isEnabled = 1
      ORDER BY project_tms.priority ASC
    `).all(projectId) as any[];
  }

  public searchConcordance(projectId: number, query: string): TMEntry[] {
    const tmIds = this.getProjectMountedTMs(projectId).map(tm => tm.id);
    if (tmIds.length === 0) return [];

    const placeholders = tmIds.map(() => '?').join(',');
    // Improved FTS Query: Use logic operators and escape quotes
    const cleanQuery = query.replace(/"/g, '""');
    const ftsQuery = `(srcText:(${cleanQuery}) OR tgtText:(${cleanQuery}))`;
    
    const rows = this.db.prepare(`
      SELECT tm_entries.* 
      FROM tm_fts 
      JOIN tm_entries ON tm_fts.tmEntryId = tm_entries.id 
      WHERE tm_fts.tmId IN (${placeholders}) AND tm_fts MATCH ?
      LIMIT 50
    `).all(...tmIds, ftsQuery) as any[];

    return rows.map(row => ({
      ...row,
      sourceTokens: JSON.parse(row.sourceTokensJson),
      targetTokens: JSON.parse(row.targetTokensJson)
    }));
  }

  // Multi-TM Management
  public listTMs(type?: 'working' | 'main'): any[] {
    if (type) {
      return this.db.prepare('SELECT * FROM tms WHERE type = ? ORDER BY updatedAt DESC').all(type);
    }
    return this.db.prepare('SELECT * FROM tms ORDER BY updatedAt DESC').all();
  }

  public createTM(name: string, srcLang: string, tgtLang: string, type: 'working' | 'main'): string {
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO tms (id, name, srcLang, tgtLang, type)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, srcLang, tgtLang, type);
    return id;
  }

  public deleteTM(id: string) {
    this.db.prepare('DELETE FROM tms WHERE id = ?').run(id);
  }

  public mountTMToProject(projectId: number, tmId: string, priority: number = 10, permission: string = 'read') {
    this.db.prepare(`
      INSERT INTO project_tms (projectId, tmId, priority, permission, isEnabled)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(projectId, tmId) DO UPDATE SET
        priority = excluded.priority,
        permission = excluded.permission,
        isEnabled = 1
    `).run(projectId, tmId, priority, permission);
  }

  public unmountTMFromProject(projectId: number, tmId: string) {
    this.db.prepare('DELETE FROM project_tms WHERE projectId = ? AND tmId = ?').run(projectId, tmId);
  }

  public getTMStats(tmId: string) {
    const count = this.db.prepare('SELECT COUNT(*) as count FROM tm_entries WHERE tmId = ?').get(tmId) as { count: number };
    return { entryCount: count.count };
  }

  public getTM(tmId: string): any | undefined {
    return this.db.prepare('SELECT * FROM tms WHERE id = ?').get(tmId);
  }

  public close() {
    this.db.close();
  }
}
