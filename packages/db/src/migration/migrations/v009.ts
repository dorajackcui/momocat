import type Database from 'better-sqlite3';
import { setSchemaVersion } from '../utils';

export function migrateToV009(db: Database.Database): void {
  console.log('[DB] Upgrading schema to v9 (Project AI temperature)...');
  db.transaction(() => {
    const columns = db.prepare('PRAGMA table_info(projects)').all() as Array<{ name: string }>;
    const hasAiTemperature = columns.some((column) => column.name === 'aiTemperature');

    if (!hasAiTemperature) {
      db.exec(`
        ALTER TABLE projects ADD COLUMN aiTemperature REAL;
      `);
    }

    setSchemaVersion(db, 9);
  })();
}
