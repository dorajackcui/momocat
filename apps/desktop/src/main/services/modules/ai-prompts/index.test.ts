import { describe, expect, it } from 'vitest';
import { buildAISystemPrompt, buildAIUserPrompt } from './index';

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
});
