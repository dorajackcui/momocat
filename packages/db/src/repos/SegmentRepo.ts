import Database from 'better-sqlite3';
import { Segment, SegmentStatus, Token } from '@cat/core';

interface SegmentRow {
  segmentId: string;
  fileId: number;
  orderIndex: number;
  sourceTokensJson: string;
  targetTokensJson: string;
  status: SegmentStatus | string;
  tagsSignature: string;
  matchKey: string;
  srcHash: string;
  metaJson: string;
}

export class SegmentRepo {
  private static readonly VALID_SEGMENT_STATUSES: Set<SegmentStatus> = new Set([
    'new',
    'draft',
    'translated',
    'confirmed',
    'reviewed',
  ]);

  constructor(
    private readonly db: Database.Database,
    private readonly updateFileStats: (fileId: number) => void
  ) {}

  public bulkInsertSegments(segments: Segment[]) {
    console.log(`[DB] Bulk inserting ${segments.length} segments`);
    const insert = this.db.prepare(`
      INSERT INTO segments (
        segmentId, fileId, orderIndex, sourceTokensJson, targetTokensJson,
        status, tagsSignature, matchKey, srcHash, metaJson
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((segmentRows: Segment[]) => {
      for (const segment of segmentRows) {
        insert.run(
          segment.segmentId,
          segment.fileId,
          segment.orderIndex,
          JSON.stringify(segment.sourceTokens),
          JSON.stringify(segment.targetTokens),
          segment.status,
          segment.tagsSignature,
          segment.matchKey,
          segment.srcHash,
          JSON.stringify(segment.meta)
        );
      }
    });

    transaction(segments);

    if (segments.length > 0) {
      this.updateFileStats(segments[0].fileId);
    }
  }

  public getProjectSegmentsByHash(projectId: number, srcHash: string): Segment[] {
    const rows = this.db
      .prepare(`
      SELECT segments.*
      FROM segments
      JOIN files ON segments.fileId = files.id
      WHERE files.projectId = ? AND segments.srcHash = ?
    `)
      .all(projectId, srcHash) as SegmentRow[];

    return rows.map((row) => this.mapRowToSegment(row));
  }

  public getSegmentsPage(fileId: number, offset: number, limit: number): Segment[] {
    const rows = this.db
      .prepare(`
      SELECT * FROM segments
      WHERE fileId = ?
      ORDER BY orderIndex ASC
      LIMIT ? OFFSET ?
    `)
      .all(fileId, limit, offset) as SegmentRow[];

    return rows.map((row) => this.mapRowToSegment(row));
  }

  public getSegment(segmentId: string): Segment | undefined {
    const row = this.db.prepare('SELECT * FROM segments WHERE segmentId = ?').get(segmentId) as SegmentRow | undefined;
    if (!row) {
      return undefined;
    }
    return this.mapRowToSegment(row);
  }

  public updateSegmentTarget(segmentId: string, targetTokens: Token[], status: SegmentStatus) {
    const normalizedStatus = this.normalizeStatus(status, targetTokens);
    this.db
      .prepare(
        "UPDATE segments SET targetTokensJson = ?, status = ?, updatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE segmentId = ?"
      )
      .run(JSON.stringify(targetTokens), normalizedStatus, segmentId);

    const row = this.db.prepare('SELECT fileId FROM segments WHERE segmentId = ?').get(segmentId) as
      | { fileId: number }
      | undefined;

    if (row) {
      this.updateFileStats(row.fileId);
    }
  }

  public getProjectStats(projectId: number): Array<{ status: string; count: number }> {
    return this.db
      .prepare(`
      SELECT
        status, COUNT(*) as count
      FROM segments
      JOIN files ON segments.fileId = files.id
      WHERE files.projectId = ?
      GROUP BY status
    `)
      .all(projectId) as Array<{ status: string; count: number }>;
  }

  public runInTransaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  private mapRowToSegment(row: SegmentRow): Segment {
    const sourceTokens = JSON.parse(row.sourceTokensJson) as Token[];
    const targetTokens = JSON.parse(row.targetTokensJson) as Token[];
    const status = this.normalizeStatus(row.status, targetTokens);
    return {
      segmentId: row.segmentId,
      fileId: row.fileId,
      orderIndex: row.orderIndex,
      sourceTokens,
      targetTokens,
      status,
      tagsSignature: row.tagsSignature,
      matchKey: row.matchKey,
      srcHash: row.srcHash,
      meta: JSON.parse(row.metaJson)
    };
  }

  private normalizeStatus(rawStatus: unknown, targetTokens: Token[]): SegmentStatus {
    if (
      typeof rawStatus === 'string' &&
      SegmentRepo.VALID_SEGMENT_STATUSES.has(rawStatus as SegmentStatus)
    ) {
      return rawStatus as SegmentStatus;
    }

    const hasTargetContent = targetTokens.some(
      (token) => token.content.trim().length > 0
    );
    return hasTargetContent ? 'draft' : 'new';
  }
}
