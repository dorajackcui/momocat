import type Database from 'better-sqlite3';

export function setSchemaVersion(db: Database.Database, version: number): void {
  const existing = db.prepare('SELECT version FROM schema_version').get() as
    | { version: number }
    | undefined;

  if (!existing) {
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(version);
    return;
  }

  db.prepare('UPDATE schema_version SET version = ?').run(version);
}
