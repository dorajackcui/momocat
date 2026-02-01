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

    // V5: Find the writable TM (Working TM) for this project
    const mountedTMs = this.db.getProjectMountedTMs(projectId);
    const workingTM = mountedTMs.find(tm => tm.type === 'working' && (tm.permission === 'write' || tm.permission === 'readwrite'));
    
    if (!workingTM) {
      console.warn(`[TMService] No writable Working TM found for project ${projectId}`);
      return;
    }

    const entry: TMEntry & { tmId: string } = {
      id: randomUUID(),
      tmId: workingTM.id,
      projectId: projectId, // Keep for compatibility if needed in core type
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

    // Check if entry exists in THIS TM
    const existing = this.db.findTMEntryByHash(workingTM.id, segment.srcHash);
    if (existing) {
      entry.id = existing.id;
    }

    this.db.upsertTMEntry(entry);
  }

  public async find100Match(projectId: number, srcHash: string) {
    // V5: Search across all mounted and enabled TMs
    const mountedTMs = this.db.getProjectMountedTMs(projectId);
    
    for (const tm of mountedTMs) {
      const match = this.db.findTMEntryByHash(tm.id, srcHash);
      if (match) {
        return {
          ...match,
          tmName: tm.name,
          tmType: tm.type
        };
      }
    }
    
    return null;
  }
}
