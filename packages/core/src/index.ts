export type TokenType = 'text' | 'tag' | 'locked' | 'ws';

export interface Token {
  type: TokenType;
  content: string;
  meta?: Record<string, any>;
}

export type SegmentStatus = 'new' | 'draft' | 'translated' | 'confirmed' | 'reviewed';

export interface Segment {
  segmentId: string;
  projectId: number;
  orderIndex: number;
  sourceTokens: Token[];
  targetTokens: Token[];
  status: SegmentStatus;
  tagsSignature: string;
  matchKey: string;
  srcHash: string;
  meta: {
    rowRef?: number;
    context?: string;
    notes?: string[];
    updatedAt: string;
  };
}

export interface Project {
  id: number;
  name: string;
  srcLang: string;
  tgtLang: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Serialize tokens to plain text for display in non-token-aware contexts
 */
export function serializeTokensToDisplayText(tokens: Token[]): string {
  return tokens.map(t => t.content).join('');
}

/**
 * Basic tokenizer for v0.1: Identifies {...} as tags
 */
export function parseDisplayTextToTokens(text: string): Token[] {
  const tokens: Token[] = [];
  const tagRegex = /\{[^{}]+\}/g;
  let lastIndex = 0;
  let match;

  while ((match = tagRegex.exec(text)) !== null) {
    // Add text before tag
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }
    // Add tag
    tokens.push({
      type: 'tag',
      content: match[0],
      meta: { id: match[0] }
    });
    lastIndex = tagRegex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    tokens.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }

  return tokens.length > 0 ? tokens : [{ type: 'text', content: text }];
}

/**
 * Compute a stable signature for tags to ensure consistency during translation
 */
export function computeTagsSignature(tokens: Token[]): string {
  return tokens
    .filter(t => t.type === 'tag')
    .map(t => t.content)
    .join('|');
}

/**
 * Compute match key for fuzzy matching and propagation
 */
export function computeMatchKey(tokens: Token[]): string {
  return tokens
    .map(t => (t.type === 'text' ? t.content.toLowerCase().trim() : `{TAG}`))
    .join(' ')
    .replace(/\s+/g, ' ');
}

/**
 * Compute hash for 100% matches
 */
export function computeSrcHash(matchKey: string, tagsSignature: string): string {
  // Simple string concatenation for v0.1, could use crypto hash later
  return `${matchKey}:::${tagsSignature}`;
}
