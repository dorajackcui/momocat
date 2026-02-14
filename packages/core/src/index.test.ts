import { describe, it, expect } from 'vitest';
import { 
  parseDisplayTextToTokens, 
  parseEditorTextToTokens,
  serializeTokensToDisplayText, 
  serializeTokensToEditorText,
  formatTagAsMemoQMarker,
  computeTagsSignature,
  computeMatchKey,
  validateSegmentTags,
  validateSegmentTerminology,
  getTagDisplayInfo,
  TagMetadata,
  TagType,
  ValidationState
} from './index';

describe('CAT Core Tokenizer', () => {
  it('should parse plain text without tags', () => {
    const text = 'Hello world';
    const tokens = parseDisplayTextToTokens(text);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toEqual({ type: 'text', content: 'Hello world' });
  });

  it('should parse text with multiple tag types', () => {
    const text = 'Hello {1} <b>world</b> %s';
    const tokens = parseDisplayTextToTokens(text);
    expect(tokens).toHaveLength(8);
    expect(tokens[0]).toEqual({ type: 'text', content: 'Hello ' });
    expect(tokens[1]).toEqual({ type: 'tag', content: '{1}', meta: { id: '{1}' } });
    expect(tokens[2]).toEqual({ type: 'text', content: ' ' });
    expect(tokens[3]).toEqual({ type: 'tag', content: '<b>', meta: { id: '<b>' } });
    expect(tokens[4]).toEqual({ type: 'text', content: 'world' });
    expect(tokens[5]).toEqual({ type: 'tag', content: '</b>', meta: { id: '</b>' } });
    expect(tokens[6]).toEqual({ type: 'text', content: ' ' });
    expect(tokens[7]).toEqual({ type: 'tag', content: '%s', meta: { id: '%s' } });
  });

  it('should support custom regex patterns for tag recognition', () => {
    const text = 'prefix @@NAME@@ suffix';
    const tokens = parseDisplayTextToTokens(text, [/\@\@[A-Z_]+\@\@/g]);
    expect(tokens).toEqual([
      { type: 'text', content: 'prefix ' },
      { type: 'tag', content: '@@NAME@@', meta: { id: '@@NAME@@' } },
      { type: 'text', content: ' suffix' }
    ]);
  });

  it('should serialize tokens back to display text', () => {
    const tokens = [
      { type: 'text', content: 'Hello ' },
      { type: 'tag', content: '{1}', meta: { id: '{1}' } },
      { type: 'text', content: ' world' }
    ];
    // @ts-ignore - Token type mismatch in test environment vs core
    const text = serializeTokensToDisplayText(tokens);
    expect(text).toBe('Hello {1} world');
  });

  it('should compute consistent tags signature', () => {
    const tokens = [
      { type: 'text', content: 'Hello ' },
      { type: 'tag', content: '{1}', meta: { id: '{1}' } },
      { type: 'text', content: ' world ' },
      { type: 'tag', content: '{2}', meta: { id: '{2}' } }
    ];
    const signature = computeTagsSignature(tokens as any);
    expect(signature).toBe('{1}|{2}');
  });

  it('should validate tag integrity correctly', () => {
    const sourceTokens = [
      { type: 'text', content: 'Hello ' },
      { type: 'tag', content: '{1}' },
      { type: 'text', content: ' world' }
    ];
    const segment = {
      sourceTokens,
      targetTokens: [{ type: 'text', content: '你好' }],
      status: 'draft',
      tagsSignature: '{1}'
    } as any;

    // Missing tag
    let issues = validateSegmentTags(segment);
    expect(issues[0].ruleId).toBe('tag-missing');

    // Correct tag
    segment.targetTokens = [{ type: 'tag', content: '{1}' }, { type: 'text', content: '你好' }];
    issues = validateSegmentTags(segment);
    expect(issues).toHaveLength(0);

    // Extra tag
    segment.targetTokens.push({ type: 'tag', content: '{2}' });
    issues = validateSegmentTags(segment);
    expect(issues[0].ruleId).toBe('tag-extra');
  });

  it('should compute consistent match key (lowercase and trimmed)', () => {
    const tokens = [
      { type: 'text', content: '  Hello  ' },
      { type: 'tag', content: '{1}', meta: { id: '{1}' } },
      { type: 'text', content: ' WORLD  ' }
    ];
    // @ts-ignore
    const key = computeMatchKey(tokens);
    expect(key).toBe('hello {TAG} world');
  });
});

describe('Terminology QA', () => {
  function buildSegment(sourceText: string, targetText: string, status: 'new' | 'draft' = 'draft') {
    return {
      segmentId: 'seg-term',
      fileId: 1,
      orderIndex: 0,
      sourceTokens: [{ type: 'text', content: sourceText }],
      targetTokens: targetText ? [{ type: 'text', content: targetText }] : [],
      status,
      tagsSignature: '',
      matchKey: sourceText.toLowerCase(),
      srcHash: sourceText.toLowerCase(),
      meta: { updatedAt: new Date().toISOString() },
    } as any;
  }

  it('creates warning when TB matched term is missing from target text', () => {
    const segment = buildSegment('Please keep your API key secure.', 'Veuillez garder votre clé en sécurité.');
    const termMatches = [
      {
        srcTerm: 'API key',
        tgtTerm: 'clé API',
        srcNorm: 'api key',
        tbName: 'Main TB',
      },
    ] as any;

    const issues = validateSegmentTerminology(segment, termMatches);
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleId).toBe('tb-term-missing');
    expect(issues[0].severity).toBe('warning');
  });

  it('passes when target already contains expected latin TB term', () => {
    const segment = buildSegment(
      'Please keep your API key secure.',
      'Veuillez garder votre clé API en sécurité.',
    );
    const termMatches = [
      {
        srcTerm: 'API key',
        tgtTerm: 'clé API',
        srcNorm: 'api key',
        tbName: 'Main TB',
      },
    ] as any;

    const issues = validateSegmentTerminology(segment, termMatches);
    expect(issues).toHaveLength(0);
  });

  it('passes when target already contains expected cjk TB term', () => {
    const segment = buildSegment('请打开设置页面。', '请打开设置页面。');
    const termMatches = [
      {
        srcTerm: '设置',
        tgtTerm: '设置',
        srcNorm: '设置',
        tbName: 'UI TB',
      },
    ] as any;

    const issues = validateSegmentTerminology(segment, termMatches);
    expect(issues).toHaveLength(0);
  });

  it('deduplicates repeated matches of the same normalized term and target term', () => {
    const segment = buildSegment('API key is required.', '凭证是必须的。');
    const termMatches = [
      {
        srcTerm: 'API key',
        tgtTerm: 'API 密钥',
        srcNorm: 'api key',
        tbName: 'TB A',
      },
      {
        srcTerm: 'api key',
        tgtTerm: 'API 密钥',
        srcNorm: 'api key',
        tbName: 'TB B',
      },
    ] as any;

    const issues = validateSegmentTerminology(segment, termMatches);
    expect(issues).toHaveLength(1);
  });
});

describe('Editor Tag Marker Conversion', () => {
  const sourceTokens = [
    { type: 'text', content: 'A ' },
    { type: 'tag', content: '<b>' },
    { type: 'text', content: 'B' },
    { type: 'tag', content: '</b>' },
    { type: 'text', content: ' C ' },
    { type: 'tag', content: '{1}' }
  ] as any;

  const sourceTokensWithDuplicate = [
    { type: 'text', content: 'A ' },
    { type: 'tag', content: '<b>' },
    { type: 'text', content: 'B' },
    { type: 'tag', content: '<b>' },
    { type: 'text', content: ' C ' },
    { type: 'tag', content: '{1}' }
  ] as any;

  it('should format memoQ-style marker by tag type', () => {
    expect(formatTagAsMemoQMarker('<b>', 1)).toBe('{1>');
    expect(formatTagAsMemoQMarker('</b>', 2)).toBe('<2}');
    expect(formatTagAsMemoQMarker('</>', 2)).toBe('<2}');
    expect(formatTagAsMemoQMarker('{1}', 3)).toBe('{3}');
  });

  it('should serialize tokens to memoQ-style editor text', () => {
    const targetTokens = [
      { type: 'text', content: 'Hello ' },
      { type: 'tag', content: '<b>' },
      { type: 'text', content: 'World' },
      { type: 'tag', content: '</b>' },
      { type: 'text', content: '!' }
    ] as any;

    const text = serializeTokensToEditorText(targetTokens, sourceTokens);
    expect(text).toBe('Hello {1>World<2}!');
  });

  it('should serialize nameless closing tags as paired-end markers', () => {
    const sourceWithNamelessClosingTag = [
      { type: 'tag', content: '<Yellow>' },
      { type: 'text', content: '化万相' },
      { type: 'tag', content: '</>' }
    ] as any;

    const targetTokens = [
      { type: 'tag', content: '<Yellow>' },
      { type: 'text', content: 'Wanxiang' },
      { type: 'tag', content: '</>' }
    ] as any;

    const text = serializeTokensToEditorText(targetTokens, sourceWithNamelessClosingTag);
    expect(text).toBe('{1>Wanxiang<2}');
  });

  it('should parse memoQ-style markers back to source tags', () => {
    const text = 'X {1>Y<2} Z {3}';
    const tokens = parseEditorTextToTokens(text, sourceTokens);

    expect(tokens).toEqual([
      { type: 'text', content: 'X ' },
      { type: 'tag', content: '<b>', meta: { id: '<b>' } },
      { type: 'text', content: 'Y' },
      { type: 'tag', content: '</b>', meta: { id: '</b>' } },
      { type: 'text', content: ' Z ' },
      { type: 'tag', content: '{1}', meta: { id: '{1}' } }
    ]);
  });

  it('should assign the same marker number to duplicate tag content', () => {
    const targetTokens = [
      { type: 'text', content: 'Hello ' },
      { type: 'tag', content: '<b>' },
      { type: 'text', content: 'World' },
      { type: 'tag', content: '<b>' }
    ] as any;

    const text = serializeTokensToEditorText(targetTokens, sourceTokensWithDuplicate);
    expect(text).toBe('Hello {1>World{1>');
  });

  it('should parse marker numbers against unique tag contents', () => {
    const text = 'X {1> Y {2}';
    const tokens = parseEditorTextToTokens(text, sourceTokensWithDuplicate);

    expect(tokens).toEqual([
      { type: 'text', content: 'X ' },
      { type: 'tag', content: '<b>', meta: { id: '<b>' } },
      { type: 'text', content: ' Y ' },
      { type: 'tag', content: '{1}', meta: { id: '{1}' } }
    ]);
  });

  it('should keep unknown marker index as plain text', () => {
    const text = 'Bad {999>} marker';
    const tokens = parseEditorTextToTokens(text, sourceTokens);
    expect(tokens).toEqual([{ type: 'text', content: 'Bad {999>} marker' }]);
  });

  it('should parse editor markers with custom marker regex', () => {
    const text = 'X [[1]] Y';
    const tokens = parseEditorTextToTokens(text, sourceTokens, {
      editorMarkerPatterns: [{ type: 'standalone', regex: /\[\[(?<index>\d+)\]\]/g }]
    });
    expect(tokens).toEqual([
      { type: 'text', content: 'X ' },
      { type: 'tag', content: '<b>', meta: { id: '<b>' } },
      { type: 'text', content: ' Y' }
    ]);
  });
});

describe('TagMetadata Interface', () => {
  it('should create a valid TagMetadata object for a paired-start tag', () => {
    const metadata: TagMetadata = {
      index: 0,
      type: 'paired-start',
      pairedIndex: 2,
      isPaired: true,
      displayText: '[1',
      validationState: 'valid'
    };
    
    expect(metadata.index).toBe(0);
    expect(metadata.type).toBe('paired-start');
    expect(metadata.pairedIndex).toBe(2);
    expect(metadata.isPaired).toBe(true);
    expect(metadata.displayText).toBe('[1');
    expect(metadata.validationState).toBe('valid');
  });

  it('should create a valid TagMetadata object for a standalone tag', () => {
    const metadata: TagMetadata = {
      index: 1,
      type: 'standalone',
      isPaired: false,
      displayText: '⟨1⟩'
    };
    
    expect(metadata.index).toBe(1);
    expect(metadata.type).toBe('standalone');
    expect(metadata.pairedIndex).toBeUndefined();
    expect(metadata.isPaired).toBe(false);
    expect(metadata.displayText).toBe('⟨1⟩');
    expect(metadata.validationState).toBeUndefined();
  });

  it('should create a valid TagMetadata object for a paired-end tag with error state', () => {
    const metadata: TagMetadata = {
      index: 3,
      type: 'paired-end',
      isPaired: false, // Unpaired closing tag
      displayText: '3]',
      validationState: 'error'
    };
    
    expect(metadata.index).toBe(3);
    expect(metadata.type).toBe('paired-end');
    expect(metadata.isPaired).toBe(false);
    expect(metadata.displayText).toBe('3]');
    expect(metadata.validationState).toBe('error');
  });

  it('should allow all valid TagType values', () => {
    const types: TagType[] = ['paired-start', 'paired-end', 'standalone'];
    types.forEach(type => {
      const metadata: TagMetadata = {
        index: 0,
        type: type,
        isPaired: type !== 'standalone',
        displayText: 'test'
      };
      expect(metadata.type).toBe(type);
    });
  });

  it('should allow all valid ValidationState values', () => {
    const states: ValidationState[] = ['valid', 'error', 'warning'];
    states.forEach(state => {
      const metadata: TagMetadata = {
        index: 0,
        type: 'standalone',
        isPaired: false,
        displayText: 'test',
        validationState: state
      };
      expect(metadata.validationState).toBe(state);
    });
  });
});

describe('getTagDisplayInfo', () => {
  describe('Paired opening tags', () => {
    it('should identify HTML opening tag and format as [N', () => {
      const result = getTagDisplayInfo('<bold>', 0);
      expect(result.display).toBe('[1');
      expect(result.type).toBe('paired-start');
    });

    it('should handle complex tag names', () => {
      const result = getTagDisplayInfo('<span-class-name>', 2);
      expect(result.display).toBe('[3');
      expect(result.type).toBe('paired-start');
    });

    it('should handle tags with numbers', () => {
      const result = getTagDisplayInfo('<h1>', 5);
      expect(result.display).toBe('[6');
      expect(result.type).toBe('paired-start');
    });
  });

  describe('Paired closing tags', () => {
    it('should identify HTML closing tag and format as N]', () => {
      const result = getTagDisplayInfo('</bold>', 1);
      expect(result.display).toBe('2]');
      expect(result.type).toBe('paired-end');
    });

    it('should handle complex closing tag names', () => {
      const result = getTagDisplayInfo('</span-class-name>', 3);
      expect(result.display).toBe('4]');
      expect(result.type).toBe('paired-end');
    });

    it('should handle closing tags with numbers', () => {
      const result = getTagDisplayInfo('</h1>', 7);
      expect(result.display).toBe('8]');
      expect(result.type).toBe('paired-end');
    });
  });

  describe('Standalone tags', () => {
    it('should identify self-closing HTML tag and format as ⟨N⟩', () => {
      const result = getTagDisplayInfo('<br/>', 0);
      expect(result.display).toBe('⟨1⟩');
      expect(result.type).toBe('standalone');
    });

    it('should identify placeholder tag {N} and use the number inside', () => {
      const result = getTagDisplayInfo('{1}', 0);
      expect(result.display).toBe('⟨1⟩');
      expect(result.type).toBe('standalone');
    });

    it('should identify placeholder tag {N} with different number', () => {
      const result = getTagDisplayInfo('{5}', 2);
      expect(result.display).toBe('⟨5⟩');
      expect(result.type).toBe('standalone');
    });

    it('should identify placeholder tag with text and use index', () => {
      const result = getTagDisplayInfo('{name}', 1);
      expect(result.display).toBe('⟨2⟩');
      expect(result.type).toBe('standalone');
    });

    it('should identify printf-style %s tag', () => {
      const result = getTagDisplayInfo('%s', 0);
      expect(result.display).toBe('⟨1⟩');
      expect(result.type).toBe('standalone');
    });

    it('should identify printf-style %d tag', () => {
      const result = getTagDisplayInfo('%d', 1);
      expect(result.display).toBe('⟨2⟩');
      expect(result.type).toBe('standalone');
    });

    it('should identify printf-style %1$s tag', () => {
      const result = getTagDisplayInfo('%1$s', 2);
      expect(result.display).toBe('⟨3⟩');
      expect(result.type).toBe('standalone');
    });

    it('should identify printf-style %f tag', () => {
      const result = getTagDisplayInfo('%f', 3);
      expect(result.display).toBe('⟨4⟩');
      expect(result.type).toBe('standalone');
    });
  });

  describe('Edge cases', () => {
    it('should handle tag at index 0', () => {
      const result = getTagDisplayInfo('<tag>', 0);
      expect(result.display).toBe('[1');
      expect(result.type).toBe('paired-start');
    });

    it('should handle tag at high index', () => {
      const result = getTagDisplayInfo('</tag>', 99);
      expect(result.display).toBe('100]');
      expect(result.type).toBe('paired-end');
    });

    it('should handle single character tag names', () => {
      const result = getTagDisplayInfo('<b>', 0);
      expect(result.display).toBe('[1');
      expect(result.type).toBe('paired-start');
    });

    it('should handle self-closing tag with attributes-like content', () => {
      const result = getTagDisplayInfo('<img-src/>', 0);
      expect(result.display).toBe('⟨1⟩');
      expect(result.type).toBe('standalone');
    });
  });

  describe('Real-world examples', () => {
    it('should handle a sequence of mixed tags', () => {
      const tags = [
        '<bold>',
        'world',
        '</bold>',
        '{1}',
        '%s'
      ];
      
      const results = tags.map((tag, index) => getTagDisplayInfo(tag, index));
      
      expect(results[0]).toEqual({ display: '[1', type: 'paired-start' });
      // Note: 'world' is not a tag, but if passed to the function:
      expect(results[1]).toEqual({ display: '⟨2⟩', type: 'standalone' });
      expect(results[2]).toEqual({ display: '3]', type: 'paired-end' });
      expect(results[3]).toEqual({ display: '⟨1⟩', type: 'standalone' });
      expect(results[4]).toEqual({ display: '⟨5⟩', type: 'standalone' });
    });
  });
});
