import type Database from 'better-sqlite3';
import { setSchemaVersion } from '../utils';

export function migrateToV013(db: Database.Database): void {
  console.log('[DB] Upgrading schema to v13 (Project QA settings)...');
  db.transaction(() => {
    const columns = db.prepare('PRAGMA table_info(projects)').all() as Array<{ name: string }>;
    const hasQaSettingsJson = columns.some((column) => column.name === 'qaSettingsJson');

    if (!hasQaSettingsJson) {
      db.exec(`
        ALTER TABLE projects ADD COLUMN qaSettingsJson TEXT;
      `);
    }

    db.exec(`
      UPDATE projects
      SET qaSettingsJson = '{"enabledRuleIds":["tag-integrity","terminology-consistency"],"instantQaOnConfirm":true}'
      WHERE qaSettingsJson IS NULL OR TRIM(qaSettingsJson) = '';
    `);

    setSchemaVersion(db, 13);
  })();
}
