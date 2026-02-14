import { Segment, TBMatch, TBEntry, serializeTokensToDisplayText } from '@cat/core';
import { TBRepository } from './ports';

type ProjectTBEntry = TBEntry & {
  tbName: string;
  priority: number;
};

export class TBService {
  private db: TBRepository;

  constructor(db: TBRepository) {
    this.db = db;
  }

  public async findMatches(projectId: number, segment: Segment): Promise<TBMatch[]> {
    const sourceText = serializeTokensToDisplayText(segment.sourceTokens);
    if (!sourceText.trim()) return [];

    const entries = this.db.listProjectTermEntries(projectId) as ProjectTBEntry[];
    if (entries.length === 0) return [];

    const matches: TBMatch[] = [];
    const seenSrcNorm = new Set<string>();

    for (const entry of entries) {
      if (seenSrcNorm.has(entry.srcNorm)) continue;
      const positions = this.findPositions(sourceText, entry.srcTerm);
      if (positions.length === 0) continue;

      matches.push({
        ...entry,
        positions,
      });
      seenSrcNorm.add(entry.srcNorm);
    }

    return matches.sort((a, b) => {
      if (b.srcTerm.length !== a.srcTerm.length) return b.srcTerm.length - a.srcTerm.length;
      return a.priority - b.priority;
    });
  }

  private findPositions(text: string, term: string): Array<{ start: number; end: number }> {
    const source = text;
    const target = term.trim();
    if (!source.trim() || !target) return [];

    const hasCjk = /[\u3400-\u9fff]/u.test(target);
    if (hasCjk) {
      const positions: Array<{ start: number; end: number }> = [];
      const sourceLower = source.toLocaleLowerCase();
      const targetLower = target.toLocaleLowerCase();
      let from = 0;

      while (from < sourceLower.length) {
        const index = sourceLower.indexOf(targetLower, from);
        if (index < 0) break;
        positions.push({ start: index, end: index + target.length });
        from = index + target.length;
      }

      return positions;
    }

    const escaped = this.escapeRegex(target);
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu');
    const positions: Array<{ start: number; end: number }> = [];
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(source)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      positions.push({ start, end });
      if (pattern.lastIndex === start) {
        pattern.lastIndex += 1;
      }
    }

    return positions;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
