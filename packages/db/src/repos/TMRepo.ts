import Database from 'better-sqlite3';
import { TMEntry } from '@cat/core';
import { randomUUID } from 'crypto';
import type { MountedTMRecord, TMEntryRow, TMRecord, TMType } from '../types';

type TMEntryDbRow = Omit<TMEntryRow, 'sourceTokens' | 'targetTokens'> & {
  sourceTokensJson: string;
  targetTokensJson: string;
};

export class TMRepo {
  private stmtUpsertTMEntry: Database.Statement;
  private stmtInsertTMEntryIfAbsentBySrcHash: Database.Statement;
  private stmtUpsertTMEntryBySrcHash: Database.Statement;
  private stmtDeleteTMFtsByEntryId: Database.Statement;
  private stmtInsertTMFts: Database.Statement;
  private stmtFindTMEntryByHash: Database.Statement;
  private stmtFindTMEntryMetaByHash: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.stmtUpsertTMEntry = this.db.prepare(`
      INSERT INTO tm_entries (
        id, tmId, srcHash, matchKey, tagsSignature,
        sourceTokensJson, targetTokensJson, originSegmentId, usageCount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        targetTokensJson = excluded.targetTokensJson,
        updatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        usageCount = usageCount + 1
    `);

    this.stmtInsertTMEntryIfAbsentBySrcHash = this.db.prepare(`
      INSERT INTO tm_entries (
        id, tmId, srcHash, matchKey, tagsSignature,
        sourceTokensJson, targetTokensJson, originSegmentId, usageCount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tmId, srcHash) DO NOTHING
      RETURNING id
    `);

    this.stmtUpsertTMEntryBySrcHash = this.db.prepare(`
      INSERT INTO tm_entries (
        id, tmId, srcHash, matchKey, tagsSignature,
        sourceTokensJson, targetTokensJson, originSegmentId, usageCount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tmId, srcHash) DO UPDATE SET
        matchKey = excluded.matchKey,
        tagsSignature = excluded.tagsSignature,
        sourceTokensJson = excluded.sourceTokensJson,
        targetTokensJson = excluded.targetTokensJson,
        originSegmentId = excluded.originSegmentId,
        updatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        usageCount = tm_entries.usageCount + 1
      RETURNING id
    `);

    this.stmtDeleteTMFtsByEntryId = this.db.prepare('DELETE FROM tm_fts WHERE tmEntryId = ?');
    this.stmtInsertTMFts = this.db.prepare(
      'INSERT INTO tm_fts (tmId, srcText, tgtText, tmEntryId) VALUES (?, ?, ?, ?)'
    );
    this.stmtFindTMEntryByHash = this.db.prepare('SELECT * FROM tm_entries WHERE tmId = ? AND srcHash = ?');
    this.stmtFindTMEntryMetaByHash = this.db.prepare(
      'SELECT id, usageCount, createdAt FROM tm_entries WHERE tmId = ? AND srcHash = ?'
    );
  }

  public upsertTMEntry(entry: TMEntry & { tmId: string }) {
    this.stmtUpsertTMEntry.run(
      entry.id,
      entry.tmId,
      entry.srcHash,
      entry.matchKey,
      entry.tagsSignature,
      JSON.stringify(entry.sourceTokens),
      JSON.stringify(entry.targetTokens),
      entry.originSegmentId,
      entry.usageCount
    );

    const srcText = entry.sourceTokens.map((token) => token.content).join('');
    const tgtText = entry.targetTokens.map((token) => token.content).join('');

    this.stmtDeleteTMFtsByEntryId.run(entry.id);
    this.stmtInsertTMFts.run(entry.tmId, srcText, tgtText, entry.id);
  }

  public insertTMEntryIfAbsentBySrcHash(entry: TMEntry & { tmId: string }): string | undefined {
    const row = this.stmtInsertTMEntryIfAbsentBySrcHash.get(
      entry.id,
      entry.tmId,
      entry.srcHash,
      entry.matchKey,
      entry.tagsSignature,
      JSON.stringify(entry.sourceTokens),
      JSON.stringify(entry.targetTokens),
      entry.originSegmentId,
      entry.usageCount
    ) as { id: string } | undefined;

    return row?.id;
  }

  public upsertTMEntryBySrcHash(entry: TMEntry & { tmId: string }): string {
    const row = this.stmtUpsertTMEntryBySrcHash.get(
      entry.id,
      entry.tmId,
      entry.srcHash,
      entry.matchKey,
      entry.tagsSignature,
      JSON.stringify(entry.sourceTokens),
      JSON.stringify(entry.targetTokens),
      entry.originSegmentId,
      entry.usageCount
    ) as { id: string } | undefined;

    if (!row?.id) {
      throw new Error('Failed to upsert TM entry by srcHash');
    }

    return row.id;
  }

  public insertTMFts(tmId: string, srcText: string, tgtText: string, tmEntryId: string) {
    this.stmtInsertTMFts.run(tmId, srcText, tgtText, tmEntryId);
  }

  public replaceTMFts(tmId: string, srcText: string, tgtText: string, tmEntryId: string) {
    this.stmtDeleteTMFtsByEntryId.run(tmEntryId);
    this.stmtInsertTMFts.run(tmId, srcText, tgtText, tmEntryId);
  }

  public findTMEntryByHash(tmId: string, srcHash: string): TMEntry | undefined {
    const row = this.stmtFindTMEntryByHash.get(tmId, srcHash) as TMEntryDbRow | undefined;

    if (!row) {
      return undefined;
    }

    return {
      ...row,
      sourceTokens: JSON.parse(row.sourceTokensJson),
      targetTokens: JSON.parse(row.targetTokensJson)
    };
  }

  public findTMEntryMetaByHash(
    tmId: string,
    srcHash: string
  ): { id: string; usageCount: number; createdAt: string } | undefined {
    const row = this.stmtFindTMEntryMetaByHash.get(tmId, srcHash) as
      | { id: string; usageCount: number; createdAt: string }
      | undefined;
    return row;
  }

  public getProjectMountedTMs(projectId: number): MountedTMRecord[] {
    return this.db
      .prepare(`
      SELECT tms.*, project_tms.priority, project_tms.permission, project_tms.isEnabled
      FROM project_tms
      JOIN tms ON project_tms.tmId = tms.id
      WHERE project_tms.projectId = ? AND project_tms.isEnabled = 1
      ORDER BY project_tms.priority ASC
    `)
      .all(projectId) as MountedTMRecord[];
  }

  public searchConcordance(projectId: number, query: string): TMEntryRow[] {
    const tmIds = this.getProjectMountedTMs(projectId).map((tm) => tm.id);
    if (tmIds.length === 0) {
      return [];
    }

    const placeholders = tmIds.map(() => '?').join(',');
    const cleanQuery = query.replace(/"/g, '""');
    const ftsQuery = `(srcText:(${cleanQuery}) OR tgtText:(${cleanQuery}))`;

    const rows = this.db
      .prepare(`
      SELECT tm_entries.*
      FROM tm_fts
      JOIN tm_entries ON tm_fts.tmEntryId = tm_entries.id
      WHERE tm_fts.tmId IN (${placeholders}) AND tm_fts MATCH ?
      LIMIT 50
    `)
      .all(...tmIds, ftsQuery) as TMEntryDbRow[];

    return rows.map((row) => ({
      ...row,
      sourceTokens: JSON.parse(row.sourceTokensJson),
      targetTokens: JSON.parse(row.targetTokensJson)
    }));
  }

  public listTMs(type?: TMType): TMRecord[] {
    if (type) {
      return this.db.prepare('SELECT * FROM tms WHERE type = ? ORDER BY updatedAt DESC').all(type) as TMRecord[];
    }
    return this.db.prepare('SELECT * FROM tms ORDER BY updatedAt DESC').all() as TMRecord[];
  }

  public createTM(name: string, srcLang: string, tgtLang: string, type: TMType): string {
    const id = randomUUID();
    this.db
      .prepare(`
      INSERT INTO tms (id, name, srcLang, tgtLang, type)
      VALUES (?, ?, ?, ?, ?)
    `)
      .run(id, name, srcLang, tgtLang, type);
    return id;
  }

  public deleteTM(id: string) {
    this.db.prepare('DELETE FROM tms WHERE id = ?').run(id);
  }

  public mountTMToProject(projectId: number, tmId: string, priority: number = 10, permission: string = 'read') {
    this.db
      .prepare(`
      INSERT INTO project_tms (projectId, tmId, priority, permission, isEnabled)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(projectId, tmId) DO UPDATE SET
        priority = excluded.priority,
        permission = excluded.permission,
        isEnabled = 1
    `)
      .run(projectId, tmId, priority, permission);
  }

  public unmountTMFromProject(projectId: number, tmId: string) {
    this.db.prepare('DELETE FROM project_tms WHERE projectId = ? AND tmId = ?').run(projectId, tmId);
  }

  public getTMStats(tmId: string) {
    const count = this.db.prepare('SELECT COUNT(*) as count FROM tm_entries WHERE tmId = ?').get(tmId) as {
      count: number;
    };
    return { entryCount: count.count };
  }

  public getTM(tmId: string): TMRecord | undefined {
    return this.db.prepare('SELECT * FROM tms WHERE id = ?').get(tmId) as TMRecord | undefined;
  }
}
