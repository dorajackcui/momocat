import { CATDatabase } from '@cat/db';
import { Segment, TMEntry } from '@cat/core';
import { randomUUID } from 'crypto';

export class TMService {
  private db: CATDatabase;

  constructor(db: CATDatabase) {
    this.db = db;
  }

  /**
   * Upsert a segment into the working TM of a project
   */
  public async upsertFromConfirmedSegment(projectId: number, segment: Segment) {
    const project = this.db.getProject(projectId);
    if (!project) return;

    const entry: TMEntry = {
      id: randomUUID(),
      projectId: projectId,
      srcLang: project.srcLang,
      tgtLang: project.tgtLang,
      srcHash: segment.srcHash,
      matchKey: segment.matchKey,
      tagsSignature: segment.tagsSignature,
      sourceTokens: segment.sourceTokens,
      targetTokens: segment.targetTokens,
      originSegmentId: segment.segmentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 1
    };

    // Check if an entry with same hash already exists for this project to update it
    const existing = this.db.findTMEntryByHash(projectId, segment.srcHash);
    if (existing) {
      entry.id = existing.id;
    }

    this.db.upsertTMEntry(entry);
  }

  /**
   * Find a 100% match in the working TM
   */
  public find100Match(projectId: number, srcHash: string): TMEntry | undefined {
    return this.db.findTMEntryByHash(projectId, srcHash);
  }
}
