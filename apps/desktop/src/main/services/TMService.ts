import { CATDatabase } from '@cat/db';
import { Segment, TMEntry, serializeTokensToDisplayText, serializeTokensToTextOnly } from '@cat/core';
import { randomUUID } from 'crypto';
import { distance } from 'fastest-levenshtein';

export interface TMMatch extends TMEntry {
  similarity: number;
  tmName: string;
  tmType: 'working' | 'main';
}

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

    const entryId = this.db.upsertTMEntryBySrcHash(entry);
    this.db.replaceTMFts(
      workingTM.id,
      serializeTokensToDisplayText(segment.sourceTokens),
      serializeTokensToDisplayText(segment.targetTokens),
      entryId
    );
  }

  /**
   * Find matches for a segment, including 100% and fuzzy matches.
   */
  public async findMatches(projectId: number, segment: Segment): Promise<TMMatch[]> {
    const mountedTMs = this.db.getProjectMountedTMs(projectId);
    if (mountedTMs.length === 0) return [];

    const sourceText = serializeTokensToDisplayText(segment.sourceTokens);
    const sourceTextOnly = serializeTokensToTextOnly(segment.sourceTokens);
    
    const results: TMMatch[] = [];
    const seenHashes = new Set<string>();

    // 1. First, check for 100% matches (exact hash)
    for (const tm of mountedTMs) {
      const match = this.db.findTMEntryByHash(tm.id, segment.srcHash);
      if (match) {
        results.push({
          ...match,
          similarity: 100,
          tmName: tm.name,
          tmType: tm.type
        });
        seenHashes.add(match.srcHash);
      }
    }

    // 2. Fuzzy matching using FTS as a candidate filter
    // Construct query from meaningful words
    const query = sourceTextOnly
      .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2)
      .join(' OR ');

    if (query) {
      const candidates = this.db.searchConcordance(projectId, query);
      
      for (const cand of candidates) {
        if (seenHashes.has(cand.srcHash)) continue;

        const candText = serializeTokensToDisplayText(cand.sourceTokens);
        const candTextOnly = serializeTokensToTextOnly(cand.sourceTokens);
        
        let similarity = 0;

        // Logic A: Text is identical, but Tags are different
        if (sourceTextOnly.toLowerCase() === candTextOnly.toLowerCase()) {
          similarity = 99; // Penalty for tag mismatch
        } else {
          // Logic B: Text is different, use Levenshtein on text-only content
          const levDist = distance(sourceTextOnly.toLowerCase(), candTextOnly.toLowerCase());
          const maxLen = Math.max(sourceTextOnly.length, candTextOnly.length);
          similarity = Math.round((1 - levDist / maxLen) * 100);
        }

        if (similarity >= 70) {
          const tm = mountedTMs.find(t => t.id === (cand as any).tmId);
          results.push({
            ...cand,
            similarity,
            tmName: tm?.name || 'Unknown TM',
            tmType: tm?.type || 'main'
          });
          seenHashes.add(cand.srcHash);
        }
      }
    }

    // Sort by similarity desc, then by usageCount desc
    return results.sort((a, b) => {
      if (b.similarity !== a.similarity) return b.similarity - a.similarity;
      return b.usageCount - a.usageCount;
    });
  }

  public async find100Match(projectId: number, srcHash: string) {
    // Keep for backward compatibility if needed, but UI should move to findMatches
    const mountedTMs = this.db.getProjectMountedTMs(projectId);
    
    for (const tm of mountedTMs) {
      const match = this.db.findTMEntryByHash(tm.id, srcHash);
      if (match) {
        return {
          ...match,
          similarity: 100,
          tmName: tm.name,
          tmType: tm.type
        };
      }
    }
    
    return null;
  }
}
