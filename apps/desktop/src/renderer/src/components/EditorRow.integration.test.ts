import { describe, expect, it } from 'vitest';
import {
  hasRefinableTargetText,
  normalizeRefinementInstruction,
  shouldShowAIRefineControl,
} from './EditorRow';

describe('EditorRow AI refine decisions', () => {
  it('identifies refinable target text correctly', () => {
    expect(hasRefinableTargetText('existing translation')).toBe(true);
    expect(hasRefinableTargetText('  existing translation  ')).toBe(true);
    expect(hasRefinableTargetText('')).toBe(false);
    expect(hasRefinableTargetText('   ')).toBe(false);
  });

  it('shows refine control only when row is active and target has text', () => {
    expect(shouldShowAIRefineControl(true, 'existing translation')).toBe(true);
    expect(shouldShowAIRefineControl(true, '   ')).toBe(false);
    expect(shouldShowAIRefineControl(false, 'existing translation')).toBe(false);
  });

  it('normalizes refine instruction before submit', () => {
    expect(normalizeRefinementInstruction('  make it concise  ')).toBe('make it concise');
    expect(normalizeRefinementInstruction('   ')).toBe('');
  });
});
