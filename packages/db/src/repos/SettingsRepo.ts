import Database from 'better-sqlite3';

export class SettingsRepo {
  constructor(private readonly db: Database.Database) {}

  public getSetting(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
      | { value?: string }
      | undefined;
    return row?.value;
  }

  public setSetting(key: string, value: string | null) {
    this.db
      .prepare(`
      INSERT INTO app_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `)
      .run(key, value);
  }
}
