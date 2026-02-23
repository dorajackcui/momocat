import type Database from 'better-sqlite3';
import { setSchemaVersion } from '../utils';

export function migrateToV014(db: Database.Database): void {
  console.log('[DB] Upgrading schema to v14 (Segment QA issue cache)...');
  db.transaction(() => {
    const segmentsTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'segments'")
      .get() as { name: string } | undefined;
    if (segmentsTable) {
      const columns = db.prepare('PRAGMA table_info(segments)').all() as Array<{ name: string }>;
      const hasQaIssuesJson = columns.some((column) => column.name === 'qaIssuesJson');

      if (!hasQaIssuesJson) {
        db.exec(`
          ALTER TABLE segments ADD COLUMN qaIssuesJson TEXT;
        `);
      }
    }

    setSchemaVersion(db, 14);
  })();
}
