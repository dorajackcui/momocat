import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import { setSchemaVersion } from '../utils';

export function migrateToV003(db: Database.Database, currentVersion: number): void {
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
          'INSERT INTO projects_v3 (id, uuid, name, srcLang, tgtLang, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).run(
          project.id,
          randomUUID(),
          project.name,
          project.srcLang,
          project.tgtLang,
          project.createdAt || new Date().toISOString(),
          project.updatedAt || new Date().toISOString(),
        );
      }
    }

    if (hasOldFiles) {
      const oldFiles = db.prepare('SELECT * FROM files').all() as any[];
      for (const file of oldFiles) {
        db.prepare(
          'INSERT INTO files_v3 (id, uuid, projectId, name, totalSegments, confirmedSegments, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ).run(
          file.id,
          randomUUID(),
          file.projectId,
          file.name,
          file.totalSegments,
          file.confirmedSegments,
          file.createdAt || new Date().toISOString(),
          file.updatedAt || new Date().toISOString(),
        );
      }
    }

    if (hasOldSegments) {
      const oldSegments = db.prepare('SELECT * FROM segments').all() as any[];
      for (const segment of oldSegments) {
        db.prepare(
          'INSERT INTO segments_v3 (segmentId, fileId, orderIndex, sourceTokensJson, targetTokensJson, status, tagsSignature, matchKey, srcHash, metaJson, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
          segment.updatedAt || new Date().toISOString(),
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
      .prepare(
        `
          SELECT s.*, f.projectId, p.srcLang, p.tgtLang
          FROM segments s
          JOIN files f ON s.fileId = f.id
          JOIN projects p ON f.projectId = p.id
          WHERE s.status = 'confirmed'
        `,
      )
      .all() as any[];

    for (const _segment of confirmedSegments) {
      // Keeping original behavior: no-op placeholder, logic handled by later migrations.
    }

    setSchemaVersion(db, 3);
  })();
}
