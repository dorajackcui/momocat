import type Database from 'better-sqlite3';
import { setSchemaVersion } from '../utils';

export function migrateToV011(db: Database.Database): void {
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

    setSchemaVersion(db, 11);
  })();
}
