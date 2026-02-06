export type TokenType = 'text' | 'tag' | 'locked' | 'ws';

export type TagType = 'paired-start' | 'paired-end' | 'standalone';

// Export TagManager service
export { TagManager } from './TagManager';

// Export TagValidator service (interfaces are defined in index.ts to avoid circular deps)
export { TagValidator } from './TagValidator';

// Export TagNavigator service
export { TagNavigator } from './TagNavigator';

export type ValidationState = 'valid' | 'error' | 'warning';

export interface Token {
  type: TokenType;
  content: string;
  meta?: {
    id?: string;
    tagType?: TagType;
    pairedIndex?: number;
    validationState?: ValidationState;
    [key: string]: any;
  };
}

export interface TagMetadata {
  index: number;
  type: TagType;
  pairedIndex?: number;
  isPaired: boolean;
  displayText: string;
  validationState?: ValidationState;
}

export type SegmentStatus = 'new' | 'draft' | 'translated' | 'confirmed' | 'reviewed';

export interface Segment {
  segmentId: string;
  fileId: number;
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
  qaIssues?: QaIssue[];
  autoFixSuggestions?: AutoFixSuggestion[];
}

export type QaSeverity = 'error' | 'warning' | 'info';

export interface QaIssue {
  ruleId: string;
  severity: QaSeverity;
  message: string;
}

/**
 * AutoFixSuggestion Interface
 * 
 * Represents an automatic fix suggestion for a tag validation error.
 */
export interface AutoFixSuggestion {
  type: 'insert' | 'delete' | 'reorder';
  description: string;
  apply: (targetTokens: Token[]) => Token[];
}

/**
 * ValidationResult Interface
 * 
 * Contains the results of tag validation.
 */
export interface ValidationResult {
  issues: QaIssue[];
  suggestions: AutoFixSuggestion[];
}

export interface TMEntry {
  id: string;
  projectId: number;
  srcLang: string;
  tgtLang: string;
  srcHash: string;
  matchKey: string;
  tagsSignature: string;
  sourceTokens: Token[];
  targetTokens: Token[];
  originSegmentId?: string;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

export interface ProjectFile {
  id: number;
  uuid: string;
  projectId: number;
  name: string;
  totalSegments: number;
  confirmedSegments: number;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: number;
  uuid: string;
  name: string;
  srcLang: string;
  tgtLang: string;
  aiPrompt?: string | null;
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
 * Convert one tag token into memoQ-like marker text.
 * Examples:
 * - paired start: {1>
 * - paired end: <2}
 * - standalone: {3}
 */
export function formatTagAsMemoQMarker(tagContent: string, tagNumber: number): string {
  const safeNumber = tagNumber > 0 ? tagNumber : 1;
  const { type } = getTagDisplayInfo(tagContent, safeNumber - 1);

  if (type === 'paired-start') {
    return `{${safeNumber}>`;
  }

  if (type === 'paired-end') {
    return `<${safeNumber}}`;
  }

  return `{${safeNumber}}`;
}

/**
 * Serialize tokens to editor text using memoQ-style tag markers.
 *
 * Tag numbers are based on source tag order, so copied/pasted markers
 * can be mapped back to source tags deterministically.
 */
export function serializeTokensToEditorText(tokens: Token[], sourceTokens: Token[]): string {
  const sourceTags = sourceTokens.filter(token => token.type === 'tag');
  const indexQueuesByContent = new Map<string, number[]>();

  sourceTags.forEach((token, index) => {
    const tagNumber = index + 1;
    const queue = indexQueuesByContent.get(token.content);
    if (queue) {
      queue.push(tagNumber);
      return;
    }
    indexQueuesByContent.set(token.content, [tagNumber]);
  });

  let fallbackTagNumber = sourceTags.length + 1;

  return tokens
    .map(token => {
      if (token.type !== 'tag') {
        return token.content;
      }

      const queue = indexQueuesByContent.get(token.content);
      const mappedTagNumber = queue && queue.length > 0 ? queue.shift()! : fallbackTagNumber++;
      return formatTagAsMemoQMarker(token.content, mappedTagNumber);
    })
    .join('');
}

/**
 * Serialize tokens to pure text only, excluding all tags and markers.
 * Used for linguistic fuzzy matching.
 */
export function serializeTokensToTextOnly(tokens: Token[]): string {
  return tokens
    .filter(t => t.type === 'text')
    .map(t => t.content)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
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
  //    Note: Space flag is excluded to prevent matching "% e" as a tag
  //    Valid flags: - # + 0 (but not space)
  const patterns = customPatterns || [
    /\{[^{}]+\}/g,
    /<[^>]+>/g,
    /%(?:\d+\$)?[-#+0]*\d*(?:\.\d+)?[hlLzjt]*[diuoxXfFeEgGaAcspn%]/g
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
 * Parse editor text that may include memoQ-like markers.
 *
 * Supported marker forms:
 * - {1>   paired opening marker
 * - <2}   paired closing marker
 * - {3}   standalone marker
 */
export function parseEditorTextToTokens(text: string, sourceTokens: Token[]): Token[] {
  const sourceTags = sourceTokens.filter(token => token.type === 'tag');
  const tokens: Token[] = [];
  let lastIndex = 0;

  const markerOrTagRegex = /(?:\{(\d+)>|<(\d+)\}|\{(\d+)\})|(\{[^{}]+\}|<[^>]+>|%(?:\d+\$)?[-#+0]*\d*(?:\.\d+)?[hlLzjt]*[diuoxXfFeEgGaAcspn%])/g;

  const pushText = (value: string) => {
    if (!value) return;
    const lastToken = tokens[tokens.length - 1];
    if (lastToken && lastToken.type === 'text') {
      lastToken.content += value;
      return;
    }
    tokens.push({ type: 'text', content: value });
  };

  let match: RegExpExecArray | null;
  while ((match = markerOrTagRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushText(text.substring(lastIndex, match.index));
    }

    const markerIndexStr = match[1] || match[2] || match[3];
    if (markerIndexStr) {
      const markerIndex = Number.parseInt(markerIndexStr, 10) - 1;
      const mappedTag = sourceTags[markerIndex];

      if (mappedTag) {
        tokens.push({
          type: 'tag',
          content: mappedTag.content,
          meta: { id: mappedTag.content }
        });
      } else {
        // Unknown marker index stays plain text instead of becoming an invalid tag token.
        pushText(match[0]);
      }
    } else {
      const rawTag = match[4];
      if (rawTag) {
        tokens.push({
          type: 'tag',
          content: rawTag,
          meta: { id: rawTag }
        });
      }
    }

    lastIndex = markerOrTagRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    pushText(text.substring(lastIndex));
  }

  return tokens.length > 0 ? tokens : [{ type: 'text', content: text }];
}

/**
 * Compute a stable signature for tags to ensure consistency during translation.
 * V0.2: Includes tag index to ensure order sensitivity.
 */
export function computeTagsSignature(tokens: Token[]): string {
  return tokens
    .filter(t => t.type === 'tag')
    .map((t, i) => `${t.content}`)
    .join('|');
}

/**
 * Extract tag contents for comparison
 */
export function extractTags(tokens: Token[]): string[] {
  return tokens.filter(t => t.type === 'tag').map(t => t.content);
}

/**
 * QA Rule: Tag Integrity
 * Ensures target has exactly the same tags as source in the same sequence.
 */
export function validateSegmentTags(segment: Segment): QaIssue[] {
  const issues: QaIssue[] = [];
  const srcTags = extractTags(segment.sourceTokens);
  const tgtTags = extractTags(segment.targetTokens);

  if (segment.status === 'new' && tgtTags.length === 0) return [];

  // 1. Check for missing tags
  const missing = srcTags.filter(t => !tgtTags.includes(t));
  if (missing.length > 0) {
    issues.push({
      ruleId: 'tag-missing',
      severity: 'error',
      message: `Missing tags: ${[...new Set(missing)].join(', ')}`
    });
  }

  // 2. Check for extra tags
  const extra = tgtTags.filter(t => !srcTags.includes(t));
  if (extra.length > 0) {
    issues.push({
      ruleId: 'tag-extra',
      severity: 'error',
      message: `Extra tags found: ${[...new Set(extra)].join(', ')}`
    });
  }

  // 3. Check for sequence/count if no missing/extra but signatures differ
  if (issues.length === 0 && segment.tagsSignature !== computeTagsSignature(segment.targetTokens)) {
    issues.push({
      ruleId: 'tag-order',
      severity: 'warning',
      message: 'Tags are present but in a different order or count than source.'
    });
  }

  return issues;
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

/**
 * Tag display information interface
 */
export interface TagDisplayInfo {
  display: string;
  type: TagType;
}

/**
 * Parse tag content and generate display information
 * 
 * This utility determines the tag type (paired-start, paired-end, or standalone)
 * and generates the appropriate display text:
 * - Paired opening tags: [N
 * - Paired closing tags: N]
 * - Standalone tags: ⟨N⟩
 * 
 * @param tagContent - The raw tag content (e.g., "<bold>", "</bold>", "{1}")
 * @param index - The zero-based index of the tag in the token sequence
 * @returns TagDisplayInfo object with display text and tag type
 * 
 * @example
 * getTagDisplayInfo('<bold>', 0) // { display: '[1', type: 'paired-start' }
 * getTagDisplayInfo('</bold>', 1) // { display: '2]', type: 'paired-end' }
 * getTagDisplayInfo('{1}', 0) // { display: '⟨1⟩', type: 'standalone' }
 */
export function getTagDisplayInfo(tagContent: string, index: number): TagDisplayInfo {
  // Check for paired opening tag: <tagname> (not self-closing)
  const pairedStartMatch = tagContent.match(/^<([^/>]+)>$/);
  
  // Check for paired closing tag: </tagname>
  const pairedEndMatch = tagContent.match(/^<\/([^>]+)>$/);
  
  // Check for standalone tags: {N}, <tag/>, %s, %d, etc.
  const standaloneMatch = tagContent.match(/^\{([^}]+)\}$|^<([^>]+)\/>$|^%(?:\d+\$)?[-#+ 0]*[\d\.]*[hlLzjt]*[diuoxXfFeEgGaAcspn%]$/);
  
  if (pairedStartMatch) {
    // Paired opening tag: display as [N
    return { 
      display: `[${index + 1}`, 
      type: 'paired-start' 
    };
  } else if (pairedEndMatch) {
    // Paired closing tag: display as N]
    return { 
      display: `${index + 1}]`, 
      type: 'paired-end' 
    };
  } else {
    // Standalone tag: display as ⟨N⟩
    // Try to extract a number from the tag content for display
    let displayNum = String(index + 1);
    
    // For {N} style tags, use the number inside
    const bracketMatch = tagContent.match(/^\{(\d+)\}$/);
    if (bracketMatch) {
      displayNum = bracketMatch[1];
    }
    
    return { 
      display: `⟨${displayNum}⟩`, 
      type: 'standalone' 
    };
  }
}
