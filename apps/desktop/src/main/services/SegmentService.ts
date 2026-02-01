import { CATDatabase } from '@cat/db';
import { Segment, SegmentStatus, Token } from '@cat/core';
import { TMService } from './TMService';

export class SegmentService {
  private db: CATDatabase;
  private tmService: TMService;

  constructor(db: CATDatabase, tmService: TMService) {
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

    // 2. If status is 'confirmed', upsert to TM
    if (status === 'confirmed') {
      const segment = this.db.getSegment(segmentId);
      if (segment) {
        const projectId = this.db.getProjectIdByFileId(segment.fileId);
        if (projectId !== undefined) {
          await this.tmService.upsertFromConfirmedSegment(projectId, segment);
        }
      }
    }
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

  // I'll add getSegment to CATDatabase and then finish this.
}
