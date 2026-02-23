import type Database from 'better-sqlite3';
import { setSchemaVersion } from '../utils';

export function migrateToV004(db: Database.Database): void {
  console.log('[DB] Upgrading schema to v4 (Adding importOptionsJson to files)...');
  db.transaction(() => {
    const columns = db.prepare('PRAGMA table_info(files)').all() as Array<{ name: string }>;
    const hasImportOptionsJson = columns.some((column) => column.name === 'importOptionsJson');

    if (!hasImportOptionsJson) {
      db.exec(`
        ALTER TABLE files ADD COLUMN importOptionsJson TEXT;
      `);
    }

    setSchemaVersion(db, 4);
  })();
}
