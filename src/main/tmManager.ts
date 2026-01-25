import fs from 'fs';
import { join } from 'path';
import { app } from 'electron';
import Database from 'better-sqlite3';
import { distance } from 'fastest-levenshtein';
import * as XLSX from 'xlsx';

export interface TMMatch {
  source: string;
  target: string;
  score: number; // 0-100
}

export class TMManager {
  private db: Database.Database;

  constructor() {
    // Use a local path for the database to avoid permission issues in restricted environments
    const dbDir = join(__dirname, '../../resources');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = join(dbDir, 'tm.db');
    console.log('TM Database Path:', dbPath);
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    // Enable Write-Ahead Logging for concurrency/speed
    this.db.pragma('journal_mode = WAL');

    // Create a normal table for storage
    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS translations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT UNIQUE,
        target TEXT
      )
    `,
      )
      .run();

    // Create an FTS5 virtual table for searching
    // 'trigram' tokenizer is excellent for fuzzy matching substrings
    // Note: FTS5 trigram tokenizer is available in recent SQLite versions.
    // If better-sqlite3 bundles an older version, we might need a fallback or just standard tokenizer.
    // Let's try standard tokenizer first to be safe, or 'unicode61'.
    this.db
      .prepare(
        `
      CREATE VIRTUAL TABLE IF NOT EXISTS tm_search 
      USING fts5(source, content='translations', content_rowid='id', tokenize='trigram');
    `,
      )
      .run();

    // Triggers to keep FTS index in sync with main table
    this.db
      .prepare(
        `
      CREATE TRIGGER IF NOT EXISTS translations_ai AFTER INSERT ON translations BEGIN
        INSERT INTO tm_search(rowid, source) VALUES (new.id, new.source);
      END;
    `,
      )
      .run();

    this.db
      .prepare(
        `
      CREATE TRIGGER IF NOT EXISTS translations_ad AFTER DELETE ON translations BEGIN
        INSERT INTO tm_search(tm_search, rowid, source) VALUES('delete', old.id, old.source);
      END;
    `,
      )
      .run();

    this.db
      .prepare(
        `
      CREATE TRIGGER IF NOT EXISTS translations_au AFTER UPDATE ON translations BEGIN
        INSERT INTO tm_search(tm_search, rowid, source) VALUES('delete', old.id, old.source);
        INSERT INTO tm_search(rowid, source) VALUES (new.id, new.source);
      END;
    `,
      )
      .run();
  }

  public get(source: string): string | undefined {
    const stmt = this.db.prepare('SELECT target FROM translations WHERE source = ?');
    const result = stmt.get(source) as { target: string } | undefined;
    return result?.target;
  }

  public set(source: string, target: string) {
    if (!source || !target) return;
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO translations (source, target) VALUES (?, ?)',
    );
    stmt.run(source, target);
  }

  public getBatch(sources: string[]): Record<string, string> {
    if (sources.length === 0) return {};

    const result: Record<string, string> = {};

    // SQLite limit for variables number is usually 999 or 32766 depending on version.
    // Safe chunk size is 900.
    const CHUNK_SIZE = 900;

    for (let i = 0; i < sources.length; i += CHUNK_SIZE) {
      const chunk = sources.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map(() => '?').join(',');
      const stmt = this.db.prepare(
        `SELECT source, target FROM translations WHERE source IN (${placeholders})`,
      );

      const rows = stmt.all(...chunk) as { source: string; target: string }[];
      for (const row of rows) {
        result[row.source] = row.target;
      }
    }

    return result;
  }

  public importFromExcel(filePath: string): number {
    try {
      const workbook = XLSX.readFile(filePath);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      let count = 0;

      const insert = this.db.prepare(
        'INSERT OR REPLACE INTO translations (source, target) VALUES (?, ?)',
      );
      const insertMany = this.db.transaction((rows: any[][]) => {
        for (const row of rows) {
          const source = row[0] ? String(row[0]).trim() : '';
          const target = row[1] ? String(row[1]).trim() : '';
          if (source && target) {
            insert.run(source, target);
            count++;
          }
        }
      });

      insertMany(rows);
      return count;
    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  }

  public fuzzySearch(query: string, threshold = 70, limit = 5): TMMatch[] {
    if (!query) return [];

    // 1. FTS Search (Candidate Generation)
    // We look for rows that match the query using FTS.
    // Since trigram matching is quite loose, it acts as a good first filter.
    // We fetch more candidates (e.g. 50) than we need to return (5).
    const ftsLimit = 50;
    const ftsStmt = this.db.prepare(`
      SELECT t.source, t.target 
      FROM tm_search s
      JOIN translations t ON s.rowid = t.id
      WHERE tm_search MATCH ? 
      ORDER BY rank
      LIMIT ?
    `);

    let candidates: { source: string; target: string }[] = [];

    try {
      // Escape double quotes in query for FTS syntax
      const escapedQuery = query.replace(/"/g, '""');
      candidates = ftsStmt.all(`"${escapedQuery}"`, ftsLimit) as {
        source: string;
        target: string;
      }[];
    } catch (e) {
      // FTS query might fail on certain inputs, fallback to empty or exact match check
      console.error('FTS query error:', e);
      return [];
    }

    // 2. Levenshtein Refinement (Re-ranking)
    const matches: TMMatch[] = [];

    for (const candidate of candidates) {
      const source = candidate.source;

      // Optimization: skip if length difference is too big
      const lenDiff = Math.abs(source.length - query.length);
      if (lenDiff / query.length > (100 - threshold) / 100) {
        continue;
      }

      const dist = distance(query, source);
      const maxLen = Math.max(query.length, source.length);
      if (maxLen === 0) continue;

      const similarity = (1 - dist / maxLen) * 100;

      if (similarity >= threshold) {
        matches.push({
          source,
          target: candidate.target,
          score: Math.round(similarity),
        });
      }
    }

    // Sort by score desc, then pick top N
    return matches.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
