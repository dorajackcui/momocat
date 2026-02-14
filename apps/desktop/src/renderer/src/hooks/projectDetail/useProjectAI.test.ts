import { describe, expect, it, vi } from 'vitest';

vi.mock('../../services/apiClient', () => ({
  apiClient: {},
}));
import {
  buildAITestMeta,
  deriveProjectAIFlags,
  normalizeProjectAIModel,
  normalizeTemperatureValue,
  parseTemperatureInput,
} from './useProjectAI';

describe('useProjectAI behavior helpers', () => {
  it('normalizes and parses temperature input safely', () => {
    expect(normalizeTemperatureValue(-1)).toBe(0);
    expect(normalizeTemperatureValue(2.9)).toBe(2);
    expect(parseTemperatureInput('1.236')).toBe(1.24);
    expect(parseTemperatureInput('')).toBeNull();
    expect(parseTemperatureInput('abc')).toBeNull();
  });

  it('derives prompt and temperature dirty state with trim-aware comparison', () => {
    const clean = deriveProjectAIFlags({
      promptDraft: '  Keep style  ',
      savedPromptValue: 'Keep style',
      temperatureDraft: '0.2',
      savedTemperatureValue: '0.2',
      modelDraft: 'gpt-4o',
      savedModelValue: 'gpt-4o',
      testMeta: null,
      testUserMessage: null,
      testPromptUsed: null,
      testRawResponse: null,
    });
    expect(clean.hasUnsavedPromptChanges).toBe(false);
    expect(clean.hasInvalidTemperature).toBe(false);

    const dirty = deriveProjectAIFlags({
      promptDraft: 'Keep style updated',
      savedPromptValue: 'Keep style',
      temperatureDraft: '1.1',
      savedTemperatureValue: '0.2',
      modelDraft: 'gpt-4o',
      savedModelValue: 'gpt-4o',
      testMeta: null,
      testUserMessage: null,
      testPromptUsed: null,
      testRawResponse: null,
    });
    expect(dirty.hasUnsavedPromptChanges).toBe(true);
    expect(dirty.hasInvalidTemperature).toBe(false);
  });

  it('marks invalid temperature and test details correctly', () => {
    const flags = deriveProjectAIFlags({
      promptDraft: 'prompt',
      savedPromptValue: 'prompt',
      temperatureDraft: 'invalid',
      savedTemperatureValue: '0.2',
      modelDraft: 'gpt-4o',
      savedModelValue: 'gpt-4o',
      testMeta: null,
      testUserMessage: 'message',
      testPromptUsed: null,
      testRawResponse: null,
    });

    expect(flags.hasInvalidTemperature).toBe(true);
    expect(flags.hasUnsavedPromptChanges).toBe(true);
    expect(flags.hasTestDetails).toBe(true);
  });

  it('marks settings as dirty when model changes only', () => {
    const flags = deriveProjectAIFlags({
      promptDraft: 'prompt',
      savedPromptValue: 'prompt',
      temperatureDraft: '0.2',
      savedTemperatureValue: '0.2',
      modelDraft: 'gpt-5.2',
      savedModelValue: 'gpt-4o',
      testMeta: null,
      testUserMessage: null,
      testPromptUsed: null,
      testRawResponse: null,
    });

    expect(flags.hasUnsavedPromptChanges).toBe(true);
    expect(flags.hasInvalidTemperature).toBe(false);
  });

  it('builds deterministic AI test meta text', () => {
    const meta = buildAITestMeta({
      status: 200,
      requestId: 'req_123',
      model: 'gpt-4o-mini',
      endpoint: '/v1/chat/completions',
      ok: false,
    });

    expect(meta).toBe(
      'status: 200 • requestId: req_123 • model: gpt-4o-mini • endpoint: /v1/chat/completions • ok: false',
    );
  });

  it('normalizes unsupported project ai model to default', () => {
    expect(normalizeProjectAIModel('gpt-5-mini')).toBe('gpt-5-mini');
    expect(normalizeProjectAIModel('gpt-unknown')).toBe('gpt-4o');
    expect(normalizeProjectAIModel(null)).toBe('gpt-4o');
  });
});
