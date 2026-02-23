import type Database from 'better-sqlite3';
import { setSchemaVersion } from '../utils';

export function migrateToV006(db: Database.Database): void {
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

    setSchemaVersion(db, 6);
  })();
}
