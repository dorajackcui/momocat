import type Database from 'better-sqlite3';
import { setSchemaVersion } from '../utils';

export function migrateToV010(db: Database.Database): void {
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

    setSchemaVersion(db, 10);
  })();
}
