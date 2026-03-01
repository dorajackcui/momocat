import { describe, expect, it } from 'vitest';
import {
  buildEditorRowDisplayModel,
  getEditorRowActionVisibility,
} from './useEditorRowDisplayModel';

describe('useEditorRowDisplayModel.buildEditorRowDisplayModel', () => {
  it('builds highlight overlays for non-printing target mode', () => {
    const model = buildEditorRowDisplayModel({
      segmentStatus: 'draft',
      qaIssues: [],
      isActive: true,
      draftText: 'A B',
      sourceEditorText: 'S T',
      sourceTagsCount: 1,
      sourceHighlightQuery: 'S',
      targetHighlightQuery: 'A',
      highlightMode: 'contains',
      showNonPrintingSymbols: true,
      isTargetFocused: false,
    });

    expect(model.showNonPrintingTargetOverlay).toBe(true);
    expect(model.showTargetHighlightOverlay).toBe(true);
    expect(model.showTargetOverlay).toBe(true);
    expect(model.sourceHighlightChunks.some((chunk) => chunk.isMatch)).toBe(true);
    expect(model.targetHighlightChunks.some((chunk) => chunk.isMatch)).toBe(true);
    expect(model.targetMirrorText).toContain('·');
  });

  it('disables non-printing target overlay while actively editing target', () => {
    const model = buildEditorRowDisplayModel({
      segmentStatus: 'translated',
      qaIssues: [],
      isActive: true,
      draftText: 'Hello',
      sourceEditorText: 'World',
      sourceTagsCount: 0,
      sourceHighlightQuery: '',
      targetHighlightQuery: '',
      highlightMode: 'contains',
      showNonPrintingSymbols: true,
      isTargetFocused: true,
    });

    expect(model.showNonPrintingTargetOverlay).toBe(false);
    expect(model.showTargetOverlay).toBe(false);
    expect(model.targetMirrorText).toBe('Hello');
  });
});

describe('useEditorRowDisplayModel.getEditorRowActionVisibility', () => {
  it('shows actions only when row is active and capability exists', () => {
    const inactive = getEditorRowActionVisibility({
      isActive: false,
      sourceTagsCount: 2,
      sourceEditorText: 'source',
      draftText: 'target',
    });
    expect(inactive.canInsertTags).toBe(true);
    expect(inactive.canAITranslate).toBe(true);
    expect(inactive.hasRefinableTarget).toBe(true);
    expect(inactive.showTargetActionButtons).toBe(false);

    const active = getEditorRowActionVisibility({
      isActive: true,
      sourceTagsCount: 0,
      sourceEditorText: 'source',
      draftText: '',
    });
    expect(active.canInsertTags).toBe(false);
    expect(active.canAITranslate).toBe(true);
    expect(active.hasRefinableTarget).toBe(false);
    expect(active.showTargetActionButtons).toBe(true);
  });
});
