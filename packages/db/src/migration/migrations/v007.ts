import type Database from 'better-sqlite3';
import { setSchemaVersion } from '../utils';

export function migrateToV007(db: Database.Database): void {
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

    setSchemaVersion(db, 7);
  })();
}
