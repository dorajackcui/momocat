import type Database from 'better-sqlite3';
import { setSchemaVersion } from '../utils';

export function migrateToV008(db: Database.Database): void {
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

    setSchemaVersion(db, 8);
  })();
}
