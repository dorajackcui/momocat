import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);

  const versionRow = db.prepare('SELECT version FROM schema_version').get() as
    | { version: number }
    | undefined;
  const currentVersion = versionRow ? versionRow.version : 0;

  if (currentVersion < 3) {
    console.log(`[DB] Upgrading schema from v${currentVersion} to v3...`);

    db.transaction(() => {
      db.exec(`
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

      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
        name: string;
      }[];
      const hasOldProjects = tables.some((table) => table.name === 'projects');
      const hasOldFiles = tables.some((table) => table.name === 'files');
      const hasOldSegments = tables.some((table) => table.name === 'segments');

      if (hasOldProjects) {
        const oldProjects = db.prepare('SELECT * FROM projects').all() as any[];
        for (const project of oldProjects) {
          db.prepare(
            'INSERT INTO projects_v3 (id, uuid, name, srcLang, tgtLang, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).run(
            project.id,
            randomUUID(),
            project.name,
            project.srcLang,
            project.tgtLang,
            project.createdAt || new Date().toISOString(),
            project.updatedAt || new Date().toISOString()
          );
        }
      }

      if (hasOldFiles) {
        const oldFiles = db.prepare('SELECT * FROM files').all() as any[];
        for (const file of oldFiles) {
          db.prepare(
            'INSERT INTO files_v3 (id, uuid, projectId, name, totalSegments, confirmedSegments, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(
            file.id,
            randomUUID(),
            file.projectId,
            file.name,
            file.totalSegments,
            file.confirmedSegments,
            file.createdAt || new Date().toISOString(),
            file.updatedAt || new Date().toISOString()
          );
        }
      }

      if (hasOldSegments) {
        const oldSegments = db.prepare('SELECT * FROM segments').all() as any[];
        for (const segment of oldSegments) {
          db.prepare(
            'INSERT INTO segments_v3 (segmentId, fileId, orderIndex, sourceTokensJson, targetTokensJson, status, tagsSignature, matchKey, srcHash, metaJson, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(
            segment.segmentId,
            segment.fileId,
            segment.orderIndex,
            segment.sourceTokensJson,
            segment.targetTokensJson,
            segment.status,
            segment.tagsSignature,
            segment.matchKey,
            segment.srcHash,
            segment.metaJson,
            segment.updatedAt || new Date().toISOString()
          );
        }
      }

      db.exec(`
        DROP TABLE IF EXISTS segments;
        DROP TABLE IF EXISTS files;
        DROP TABLE IF EXISTS projects;

        ALTER TABLE projects_v3 RENAME TO projects;
        ALTER TABLE files_v3 RENAME TO files;
        ALTER TABLE segments_v3 RENAME TO segments;

        CREATE INDEX idx_files_project ON files(projectId);
        CREATE INDEX idx_segments_file_order ON segments(fileId, orderIndex);
        CREATE INDEX idx_segments_file_srcHash ON segments(fileId, srcHash);
        CREATE INDEX idx_tm_project_srcHash ON tm_entries(projectId, srcHash);
        CREATE INDEX idx_tm_project_matchKey ON tm_entries(projectId, matchKey);
      `);

      const confirmedSegments = db
        .prepare(`
          SELECT s.*, f.projectId, p.srcLang, p.tgtLang
          FROM segments s
          JOIN files f ON s.fileId = f.id
          JOIN projects p ON f.projectId = p.id
          WHERE s.status = 'confirmed'
        `)
        .all() as any[];

      for (const _segment of confirmedSegments) {
        // Keeping original behavior: no-op placeholder, logic handled by later migrations.
      }

      if (!versionRow) {
        db.prepare('INSERT INTO schema_version (version) VALUES (3)').run();
      } else {
        db.prepare('UPDATE schema_version SET version = 3').run();
      }
    })();
  }

  if (currentVersion < 4) {
    console.log('[DB] Upgrading schema to v4 (Adding importOptionsJson to files)...');
    db.exec(`
      ALTER TABLE files ADD COLUMN importOptionsJson TEXT;
    `);
  }

  if (currentVersion < 5) {
    console.log('[DB] Upgrading schema to v5 (Multi-TM Architecture)...');
    db.transaction(() => {
      db.exec(`
        CREATE TABLE tms (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          srcLang TEXT NOT NULL,
          tgtLang TEXT NOT NULL,
          type TEXT NOT NULL,
          createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );

        CREATE TABLE project_tms (
          projectId INTEGER NOT NULL,
          tmId TEXT NOT NULL,
          priority INTEGER NOT NULL DEFAULT 0,
          permission TEXT NOT NULL DEFAULT 'read',
          isEnabled INTEGER NOT NULL DEFAULT 1,
          PRIMARY KEY(projectId, tmId),
          FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (tmId) REFERENCES tms(id) ON DELETE CASCADE
        );

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

      const projects = db.prepare('SELECT * FROM projects').all() as any[];
      for (const project of projects) {
        const workingTmId = randomUUID();
        db.prepare(
          `
            INSERT INTO tms (id, name, srcLang, tgtLang, type, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `
        ).run(
          workingTmId,
          `${project.name} (Working TM)`,
          project.srcLang,
          project.tgtLang,
          'working',
          project.createdAt,
          project.updatedAt
        );

        db.prepare(
          `
            INSERT INTO project_tms (projectId, tmId, priority, permission, isEnabled)
            VALUES (?, ?, ?, ?, ?)
          `
        ).run(project.id, workingTmId, 0, 'readwrite', 1);

        const oldEntries = db.prepare('SELECT * FROM tm_entries WHERE projectId = ?').all(project.id) as any[];
        for (const entry of oldEntries) {
          db.prepare(
            `
              INSERT INTO tm_entries_v5 (
                id, tmId, srcHash, matchKey, tagsSignature,
                sourceTokensJson, targetTokensJson, originSegmentId,
                createdAt, updatedAt, usageCount
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `
          ).run(
            entry.id,
            workingTmId,
            entry.srcHash,
            entry.matchKey,
            entry.tagsSignature,
            entry.sourceTokensJson,
            entry.targetTokensJson,
            entry.originSegmentId,
            entry.createdAt,
            entry.updatedAt,
            entry.usageCount
          );
        }
      }

      db.exec(`
        DROP TABLE tm_entries;
        ALTER TABLE tm_entries_v5 RENAME TO tm_entries;

        CREATE INDEX idx_project_tms_project ON project_tms(projectId, isEnabled, priority);
        CREATE INDEX idx_tm_entries_tm_srcHash ON tm_entries(tmId, srcHash);
        CREATE INDEX idx_tm_entries_tm_matchKey ON tm_entries(tmId, matchKey);
      `);

      db.exec(`
        DROP TABLE tm_fts;
        CREATE VIRTUAL TABLE tm_fts USING fts5(
          tmId UNINDEXED,
          srcText,
          tgtText,
          tmEntryId UNINDEXED
        );
      `);

      const allEntries = db.prepare('SELECT * FROM tm_entries').all() as any[];
      for (const entry of allEntries) {
        const srcText = JSON.parse(entry.sourceTokensJson)
          .map((token: any) => token.content)
          .join('');
        const tgtText = JSON.parse(entry.targetTokensJson)
          .map((token: any) => token.content)
          .join('');
        db.prepare('INSERT INTO tm_fts (tmId, srcText, tgtText, tmEntryId) VALUES (?, ?, ?, ?)').run(
          entry.tmId,
          srcText,
          tgtText,
          entry.id
        );
      }

      db.prepare('UPDATE schema_version SET version = 5').run();
    })();
  }

  if (currentVersion < 6) {
    console.log('[DB] Upgrading schema to v6 (Fixing Foreign Keys for Files/Segments)...');
    db.transaction(() => {
      db.exec(`
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
        INSERT INTO files_v6
        SELECT id, uuid, projectId, name, totalSegments, confirmedSegments, importOptionsJson, createdAt, updatedAt
        FROM files;
        DROP TABLE files;
        ALTER TABLE files_v6 RENAME TO files;
      `);

      db.exec(`
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

      db.prepare('UPDATE schema_version SET version = 6').run();
    })();
  }

  if (currentVersion < 7) {
    console.log('[DB] Upgrading schema to v7 (AI prompt + app settings)...');
    db.transaction(() => {
      db.exec(`
        ALTER TABLE projects ADD COLUMN aiPrompt TEXT;

        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT,
          updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );
      `);

      db.prepare('UPDATE schema_version SET version = 7').run();
    })();
  }

  if (currentVersion < 8) {
    console.log('[DB] Upgrading schema to v8 (TM unique srcHash per TM)...');
    db.transaction(() => {
      db.exec(`
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

      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tm_entries_tm_srcHash_unique
        ON tm_entries(tmId, srcHash);
      `);

      db.prepare('UPDATE schema_version SET version = 8').run();
    })();
  }

  if (currentVersion < 9) {
    console.log('[DB] Upgrading schema to v9 (Project AI temperature)...');
    db.transaction(() => {
      const columns = db.prepare('PRAGMA table_info(projects)').all() as Array<{ name: string }>;
      const hasAiTemperature = columns.some((column) => column.name === 'aiTemperature');

      if (!hasAiTemperature) {
        db.exec(`
          ALTER TABLE projects ADD COLUMN aiTemperature REAL;
        `);
      }

      db.prepare('UPDATE schema_version SET version = 9').run();
    })();
  }

  if (currentVersion < 10) {
    console.log('[DB] Upgrading schema to v10 (Term Base system)...');
    db.transaction(() => {
      db.exec(`
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

      db.prepare('UPDATE schema_version SET version = 10').run();
    })();
  }

  if (currentVersion < 11) {
    console.log('[DB] Upgrading schema to v11 (Project type)...');
    db.transaction(() => {
      const columns = db.prepare('PRAGMA table_info(projects)').all() as Array<{ name: string }>;
      const hasProjectType = columns.some((column) => column.name === 'projectType');

      if (!hasProjectType) {
        db.exec(`
          ALTER TABLE projects ADD COLUMN projectType TEXT NOT NULL DEFAULT 'translation';
        `);
      }

      db.exec(`
        UPDATE projects
        SET projectType = 'translation'
        WHERE projectType IS NULL OR TRIM(projectType) = '';
      `);

      db.prepare('UPDATE schema_version SET version = 11').run();
    })();
  }

  if (currentVersion < 12) {
    console.log('[DB] Upgrading schema to v12 (Project AI model)...');
    db.transaction(() => {
      const columns = db.prepare('PRAGMA table_info(projects)').all() as Array<{ name: string }>;
      const hasAiModel = columns.some((column) => column.name === 'aiModel');

      if (!hasAiModel) {
        db.exec(`
          ALTER TABLE projects ADD COLUMN aiModel TEXT DEFAULT 'gpt-4o';
        `);
      }

      db.exec(`
        UPDATE projects
        SET aiModel = 'gpt-4o'
        WHERE aiModel IS NULL
           OR TRIM(aiModel) = ''
           OR aiModel NOT IN ('gpt-5.2', 'gpt-5-mini', 'gpt-4o', 'gpt-4.1-mini');
      `);

      db.prepare('UPDATE schema_version SET version = 12').run();
    })();
  }
}
