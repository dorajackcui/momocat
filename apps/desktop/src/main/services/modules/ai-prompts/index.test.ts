import { describe, expect, it } from 'vitest';
import { buildAIDialogueUserPrompt, buildAISystemPrompt, buildAIUserPrompt } from './index';

describe('ai-prompt templates', () => {
  it('builds translation system prompt with project prompt prefix', () => {
    const prompt = buildAISystemPrompt('translation', {
      srcLang: 'en',
      tgtLang: 'zh',
      projectPrompt: 'Use concise style.',
    });

    expect(prompt).toContain('Use concise style.');
    expect(prompt).toContain('Translate from en to zh.');
  });

  it('builds review system prompt with explicit language instruction when custom prompt is provided', () => {
    const prompt = buildAISystemPrompt('review', {
      srcLang: 'en',
      tgtLang: 'zh',
      projectPrompt: 'Fix terminology only.',
    });

    expect(prompt).toContain('Original text language: en. Translation text language: zh.');
    expect(prompt).toContain('Fix terminology only.');
  });

  it('uses custom system prompt as full replacement', () => {
    const prompt = buildAISystemPrompt('custom', {
      srcLang: 'en',
      tgtLang: 'zh',
      projectPrompt: 'Classify sentiment as positive/negative.',
    });

    expect(prompt).toBe('Classify sentiment as positive/negative.');
  });

  it('builds translation user prompt with source header and context', () => {
    const prompt = buildAIUserPrompt('translation', {
      srcLang: 'en',
      sourcePayload: 'Hello world',
      hasProtectedMarkers: false,
      context: 'UI label',
    });

    expect(prompt).toContain('Source (en):');
    expect(prompt).toContain('Context: UI label');
  });

  it('builds translation user prompt with TM and TB references', () => {
    const prompt = buildAIUserPrompt('translation', {
      srcLang: 'en',
      sourcePayload: 'Hello world',
      hasProtectedMarkers: false,
      context: 'UI label',
      tmReference: {
        similarity: 98,
        tmName: 'Main TM',
        sourceText: 'Hello world',
        targetText: '你好世界',
      },
      tbReferences: [
        { srcTerm: 'world', tgtTerm: '世界' },
        { srcTerm: 'hello', tgtTerm: '你好', note: 'prefer short form' },
      ],
    });

    expect(prompt).toContain('TM Reference (best match):');
    expect(prompt).toContain('- Similarity: 98% | TM: Main TM');
    expect(prompt).toContain('- Source: Hello world');
    expect(prompt).toContain('- Target: 你好世界');
    expect(prompt).toContain('Terminology References (hit terms):');
    expect(prompt).toContain('- world => 世界');
    expect(prompt).toContain('- hello => 你好 (note: prefer short form)');
  });

  it('does not include TM/TB sections when translation references are absent', () => {
    const prompt = buildAIUserPrompt('translation', {
      srcLang: 'en',
      sourcePayload: 'Hello world',
      hasProtectedMarkers: false,
      context: 'UI label',
    });

    expect(prompt).not.toContain('TM Reference (best match):');
    expect(prompt).not.toContain('Terminology References (hit terms):');
  });

  it('does not include context line for translation user prompt when context is empty', () => {
    const prompt = buildAIUserPrompt('translation', {
      srcLang: 'en',
      sourcePayload: 'Hello world',
      hasProtectedMarkers: false,
      context: '   ',
    });

    expect(prompt).toContain('Source (en):');
    expect(prompt).not.toContain('Context:');
  });

  it('builds translation user prompt with refinement instruction and current translation', () => {
    const prompt = buildAIUserPrompt('translation', {
      srcLang: 'en',
      sourcePayload: 'Hello world',
      hasProtectedMarkers: false,
      context: 'UI label',
      currentTranslationPayload: '你好，世界',
      refinementInstruction: 'Make tone more concise',
    });

    expect(prompt).toContain('Current Translation:');
    expect(prompt).toContain('你好，世界');
    expect(prompt).toContain('Refinement Instruction:');
    expect(prompt).toContain('Make tone more concise');
  });

  it('does not include refinement section when only one refinement field is present', () => {
    const prompt = buildAIUserPrompt('translation', {
      srcLang: 'en',
      sourcePayload: 'Hello world',
      hasProtectedMarkers: false,
      currentTranslationPayload: '你好，世界',
    });

    expect(prompt).not.toContain('Current Translation:');
    expect(prompt).not.toContain('Refinement Instruction:');
  });

  it('builds review user prompt with validation feedback', () => {
    const prompt = buildAIUserPrompt('review', {
      srcLang: 'en',
      sourcePayload: 'Translated text',
      hasProtectedMarkers: false,
      context: '',
      validationFeedback: 'Missing marker {1}',
    });

    expect(prompt).toContain('Source (en):');
    expect(prompt).toContain('Validation feedback from previous attempt:');
    expect(prompt).toContain('Missing marker {1}');
  });

  it('builds custom user prompt with input header', () => {
    const prompt = buildAIUserPrompt('custom', {
      srcLang: 'en',
      sourcePayload: 'Process this text',
      hasProtectedMarkers: false,
      context: 'context text',
    });

    expect(prompt).toContain('Input:');
    expect(prompt).toContain('Context: context text');
  });

  it('does not include context line for custom user prompt when context is empty', () => {
    const prompt = buildAIUserPrompt('custom', {
      srcLang: 'en',
      sourcePayload: 'Process this text',
      hasProtectedMarkers: false,
      context: '   ',
    });

    expect(prompt).toContain('Input:');
    expect(prompt).not.toContain('Context:');
  });

  it('builds dialogue translation user prompt with previous group and json contract', () => {
    const prompt = buildAIDialogueUserPrompt({
      srcLang: 'en',
      tgtLang: 'zh',
      segments: [
        {
          id: 'seg-1',
          speaker: 'Alice',
          sourcePayload: 'Hello there',
        },
        {
          id: 'seg-2',
          speaker: 'Alice',
          sourcePayload: 'How are you?',
        },
      ],
      previousGroup: {
        speaker: 'Bob',
        sourceText: 'Good morning',
        targetText: '早上好',
      },
    });

    expect(prompt).toContain('Return strict JSON only');
    expect(prompt).toContain('{"translations":[{"id":"<segment-id>","text":"<translated-text>"}]}');
    expect(prompt).toContain('id: seg-1');
    expect(prompt).toContain('speaker: Alice');
    expect(prompt).toContain('Previous Dialogue Group (for consistency):');
    expect(prompt).toContain('speaker: Bob');
    expect(prompt).toContain('target:');
    expect(prompt).toContain('早上好');
  });
});
