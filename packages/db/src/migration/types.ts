import type Database from 'better-sqlite3';

export interface MigrationStep {
  version: number;
  up: (db: Database.Database) => void;
}
