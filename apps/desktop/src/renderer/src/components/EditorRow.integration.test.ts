import { describe, expect, it } from 'vitest';
import {
  hasRefinableTargetText,
  normalizeRefinementInstruction,
  parseVisualizedNonPrintingSymbols,
  shouldSyncDraftFromExternalTarget,
  shouldShowAIRefineControl,
  visualizeNonPrintingSymbols,
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

  it('visualizes non-printing symbols with distinct markers', () => {
    const input = 'A B\u00A0C\u202FD\tE\nF';
    expect(visualizeNonPrintingSymbols(input)).toBe('A·B⍽C⎵D⇥E↵\nF');
  });

  it('parses visualized non-printing symbols back to raw text', () => {
    const visualized = 'A·B⍽C⎵D⇥E↵\nF';
    expect(parseVisualizedNonPrintingSymbols(visualized)).toBe('A B\u00A0C\u202FD\tE\nF');
  });
});

describe('EditorRow draft sync gating', () => {
  it('syncs while active textarea is focused when external text changes', () => {
    expect(
      shouldSyncDraftFromExternalTarget({
        isDraftSyncSuspended: false,
        draftText: 'old',
        targetEditorText: 'new',
        isActive: true,
      }),
    ).toBe(true);
  });

  it('syncs when active row is not focused (TM/TB apply scenario)', () => {
    expect(
      shouldSyncDraftFromExternalTarget({
        isDraftSyncSuspended: false,
        draftText: 'old',
        targetEditorText: 'new',
        isActive: true,
      }),
    ).toBe(true);
  });

  it('syncs for inactive row when text changed', () => {
    expect(
      shouldSyncDraftFromExternalTarget({
        isDraftSyncSuspended: false,
        draftText: 'old',
        targetEditorText: 'new',
        isActive: false,
      }),
    ).toBe(true);
  });

  it('syncs when blur flush window is active but row is still active', () => {
    expect(
      shouldSyncDraftFromExternalTarget({
        isDraftSyncSuspended: true,
        draftText: 'old',
        targetEditorText: 'new',
        isActive: true,
      }),
    ).toBe(true);
  });

  it('does not sync when blur flush window is active and row is inactive', () => {
    expect(
      shouldSyncDraftFromExternalTarget({
        isDraftSyncSuspended: true,
        draftText: 'old',
        targetEditorText: 'new',
        isActive: false,
      }),
    ).toBe(false);
  });

  it('does not sync when draft already equals external text', () => {
    expect(
      shouldSyncDraftFromExternalTarget({
        isDraftSyncSuspended: false,
        draftText: 'same',
        targetEditorText: 'same',
        isActive: true,
      }),
    ).toBe(false);
  });
});
