import { CATDatabase } from '@cat/db';
import { Segment, SegmentStatus, Token } from '@cat/core';
import { TMService } from './TMService';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';

interface PropagationBatch {
  id: string;
  projectId: number;
  timestamp: string;
  changes: {
    segmentId: string;
    oldTargetTokens: Token[];
    oldStatus: SegmentStatus;
  }[];
}

export class SegmentService extends EventEmitter {
  private db: CATDatabase;
  private tmService: TMService;
  private lastBatch: PropagationBatch | null = null;

  constructor(db: CATDatabase, tmService: TMService) {
    super();
    this.db = db;
    this.tmService = tmService;
  }

  public getSegments(fileId: number, offset: number, limit: number): Segment[] {
    return this.db.getSegmentsPage(fileId, offset, limit);
  }

  /**
   * Update segment target and status, ensuring file stats and TM are updated
   */
  public async updateSegment(segmentId: string, targetTokens: Token[], status: SegmentStatus) {
    // 1. Update the segment in DB
    this.db.updateSegmentTarget(segmentId, targetTokens, status);

    let propagatedIds: string[] = [];

    // 2. If status is 'confirmed', upsert to TM and propagate
    if (status === 'confirmed') {
      const segment = this.db.getSegment(segmentId);
      if (segment) {
        const projectId = this.db.getProjectIdByFileId(segment.fileId);
        if (projectId !== undefined) {
          await this.tmService.upsertFromConfirmedSegment(projectId, segment);
          propagatedIds = await this.propagate(projectId, segment);
        }
      }
    }

    // Notify about updates (including propagation)
    this.emit('segments-updated', {
      segmentId,
      targetTokens,
      status,
      propagatedIds
    });

    return { propagatedIds };
  }

  /**
   * Propagate translation to all identical segments in the project
   */
  private async propagate(projectId: number, sourceSegment: Segment): Promise<string[]> {
    console.log(`[SegmentService] Propagating segment ${sourceSegment.segmentId} in project ${projectId}`);
    
    // Find segments with same srcHash in the same project (across files)
     const repeats = this.db.getProjectSegmentsByHash(projectId, sourceSegment.srcHash)
       .filter((s: Segment) => s.segmentId !== sourceSegment.segmentId && s.status !== 'confirmed');
 
     if (repeats.length === 0) return [];

    const batch: PropagationBatch = {
      id: randomUUID(),
      projectId,
      timestamp: new Date().toISOString(),
      changes: []
    };

    const updatedIds: string[] = [];

    for (const seg of repeats) {
      // Record for undo
      batch.changes.push({
        segmentId: seg.segmentId,
        oldTargetTokens: seg.targetTokens,
        oldStatus: seg.status
      });

      // Update segment (using draft status for propagated translations)
      this.db.updateSegmentTarget(seg.segmentId, sourceSegment.targetTokens, 'draft');
      updatedIds.push(seg.segmentId);
    }

    this.lastBatch = batch;
    console.log(`[SegmentService] Propagated to ${repeats.length} segments. Batch ID: ${batch.id}`);
    return updatedIds;
  }

  public async undoLastPropagation() {
    if (!this.lastBatch) return;

    console.log(`[SegmentService] Undoing propagation batch: ${this.lastBatch.id}`);
    for (const change of this.lastBatch.changes) {
      this.db.updateSegmentTarget(change.segmentId, change.oldTargetTokens, change.oldStatus);
    }

    this.lastBatch = null;
  }

  public async confirmSegment(segmentId: string) {
    const segment = this.db.getSegment(segmentId);
    if (segment) {
      await this.updateSegment(segmentId, segment.targetTokens, 'confirmed');
    }
  }

  public async bulkUpdateStatus(segmentIds: string[], status: SegmentStatus) {
    // For now, simple loop. In production, use transaction.
    for (const id of segmentIds) {
      const seg = this.db.getSegment(id);
      if (seg) {
        await this.updateSegment(id, seg.targetTokens, status);
      }
    }
  }
}
