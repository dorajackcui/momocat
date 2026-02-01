export type TokenType = 'text' | 'tag' | 'locked' | 'ws';

export interface Token {
  type: TokenType;
  content: string;
  meta?: Record<string, any>;
}

export type SegmentStatus = 'new' | 'draft' | 'translated' | 'confirmed' | 'reviewed';

export interface Segment {
  segmentId: string;
  fileId: number;
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

export interface ProjectFile {
  id: number;
  projectId: number;
  name: string;
  totalSegments: number;
  confirmedSegments: number;
  createdAt: string;
  updatedAt: string;
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
 * Extensible tokenizer for v0.1.1+: 
 * Supports configurable patterns and maintains correct inline positioning.
 */
export function parseDisplayTextToTokens(text: string, customPatterns?: RegExp[]): Token[] {
  // Default patterns: 
  // 1. {1}, {tag}
  // 2. <tag>, </tag>, <tag/>
  // 3. %s, %d, %1$s (common printf-style)
  const patterns = customPatterns || [
    /\{[^{}]+\}/g,
    /<[^>]+>/g,
    /%(?:\d+\$)?[-#+ 0]*[\d\.]*[hlLzjt]*[diuoxXfFeEgGaAcspn%]/g
  ];

  const tokens: Token[] = [];
  let lastIndex = 0;

  // Combine all patterns into one global regex to find matches in order
  const combinedRegex = new RegExp(patterns.map(p => `(${p.source})`).join('|'), 'g');
  
  let match;
  while ((match = combinedRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }

    // The match itself is a tag
    tokens.push({
      type: 'tag',
      content: match[0],
      meta: { id: match[0] }
    });

    lastIndex = combinedRegex.lastIndex;
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
