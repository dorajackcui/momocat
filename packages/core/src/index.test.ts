import { describe, it, expect } from 'vitest';
import { 
  parseDisplayTextToTokens, 
  serializeTokensToDisplayText, 
  computeTagsSignature,
  computeMatchKey
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
    // @ts-ignore
    const signature = computeTagsSignature(tokens);
    expect(signature).toBe('{1}|{2}');
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
