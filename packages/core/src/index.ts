export type TokenType = 'text' | 'tag' | 'locked' | 'ws';

export type TagType = 'paired-start' | 'paired-end' | 'standalone';

// Export TagManager service
export { TagManager } from './TagManager';

// Export TagValidator service (interfaces are defined in index.ts to avoid circular deps)
export { TagValidator } from './TagValidator';

// Export TagNavigator service
export { TagNavigator } from './TagNavigator';
export {
  formatTagAsMemoQMarker,
  serializeTokensToEditorText,
  parseDisplayTextToTokens,
  parseEditorTextToTokens,
  type ParseEditorTextOptions
} from './tag/TagCodec';
export {
  TAG_PATTERN_REGISTRY,
  getDisplayTagPatterns,
  getEditorMarkerPatterns,
  type EditorMarkerPattern,
  type TagPatternRegistryConfig
} from './tag/TagPatternRegistry';

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

export interface TermBase {
  id: string;
  name: string;
  srcLang: string;
  tgtLang: string;
  createdAt: string;
  updatedAt: string;
}

export interface TBEntry {
  id: string;
  tbId: string;
  srcTerm: string;
  tgtTerm: string;
  srcNorm: string;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

export interface TBMatch extends TBEntry {
  tbName: string;
  priority: number;
  positions: Array<{ start: number; end: number }>;
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
  projectType?: ProjectType;
  aiPrompt?: string | null;
  aiTemperature?: number | null;
  createdAt: string;
  updatedAt: string;
}

export type ProjectType = 'translation' | 'review';

/**
 * Serialize tokens to plain text for display in non-token-aware contexts
 */
export function serializeTokensToDisplayText(tokens: Token[]): string {
  return tokens.map(t => t.content).join('');
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
