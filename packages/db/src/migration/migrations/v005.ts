import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import { setSchemaVersion } from '../utils';

export function migrateToV005(db: Database.Database): void {
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
        `,
      ).run(
        workingTmId,
        `${project.name} (Working TM)`,
        project.srcLang,
        project.tgtLang,
        'working',
        project.createdAt,
        project.updatedAt,
      );

      db.prepare(
        `
          INSERT INTO project_tms (projectId, tmId, priority, permission, isEnabled)
          VALUES (?, ?, ?, ?, ?)
        `,
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
          `,
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
          entry.usageCount,
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
        entry.id,
      );
    }

    setSchemaVersion(db, 5);
  })();
}
