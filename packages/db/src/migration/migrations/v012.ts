import type Database from 'better-sqlite3';
import { DEFAULT_PROJECT_AI_MODEL, PROJECT_AI_MODELS } from '@cat/core';
import { setSchemaVersion } from '../utils';

export function migrateToV012(db: Database.Database): void {
  const sqlQuotedProjectAIModels = PROJECT_AI_MODELS.map((model) => `'${model}'`).join(', ');

  console.log('[DB] Upgrading schema to v12 (Project AI model)...');
  db.transaction(() => {
    const columns = db.prepare('PRAGMA table_info(projects)').all() as Array<{ name: string }>;
    const hasAiModel = columns.some((column) => column.name === 'aiModel');

    if (!hasAiModel) {
      db.exec(`
        ALTER TABLE projects ADD COLUMN aiModel TEXT DEFAULT '${DEFAULT_PROJECT_AI_MODEL}';
      `);
    }

    db.exec(`
      UPDATE projects
      SET aiModel = '${DEFAULT_PROJECT_AI_MODEL}'
      WHERE aiModel IS NULL
         OR TRIM(aiModel) = ''
         OR aiModel NOT IN (${sqlQuotedProjectAIModels});
    `);

    setSchemaVersion(db, 12);
  })();
}
