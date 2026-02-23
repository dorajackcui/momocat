import type Database from 'better-sqlite3';
import type { MigrationStep } from './types';
import { migrateToV003 } from './migrations/v003';
import { migrateToV004 } from './migrations/v004';
import { migrateToV005 } from './migrations/v005';
import { migrateToV006 } from './migrations/v006';
import { migrateToV007 } from './migrations/v007';
import { migrateToV008 } from './migrations/v008';
import { migrateToV009 } from './migrations/v009';
import { migrateToV010 } from './migrations/v010';
import { migrateToV011 } from './migrations/v011';
import { migrateToV012 } from './migrations/v012';
import { migrateToV013 } from './migrations/v013';
import { migrateToV014 } from './migrations/v014';

const MIGRATION_STEPS: MigrationStep[] = [
  { version: 4, up: migrateToV004 },
  { version: 5, up: migrateToV005 },
  { version: 6, up: migrateToV006 },
  { version: 7, up: migrateToV007 },
  { version: 8, up: migrateToV008 },
  { version: 9, up: migrateToV009 },
  { version: 10, up: migrateToV010 },
  { version: 11, up: migrateToV011 },
  { version: 12, up: migrateToV012 },
  { version: 13, up: migrateToV013 },
  { version: 14, up: migrateToV014 },
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);

  const versionRow = db.prepare('SELECT version FROM schema_version').get() as
    | { version: number }
    | undefined;
  let currentVersion = versionRow ? versionRow.version : 0;

  if (currentVersion < 3) {
    migrateToV003(db, currentVersion);
    currentVersion = 3;
  }

  for (const step of MIGRATION_STEPS) {
    if (currentVersion < step.version) {
      step.up(db);
      currentVersion = step.version;
    }
  }
}
