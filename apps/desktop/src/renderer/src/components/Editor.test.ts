import { describe, expect, it } from 'vitest';
import {
  isVirtualizedEditorListEnabled,
  VIRTUALIZED_LIST_FLAG_KEY,
} from './editor/editorVirtualizationFlag';

describe('Editor virtualization flag', () => {
  it('enables virtualization only when flag is set to "1"', () => {
    const enabledStorage = {
      getItem: (key: string) => (key === VIRTUALIZED_LIST_FLAG_KEY ? '1' : null),
    };
    const disabledStorage = {
      getItem: () => null,
    };

    expect(isVirtualizedEditorListEnabled(enabledStorage)).toBe(true);
    expect(isVirtualizedEditorListEnabled(disabledStorage)).toBe(false);
  });
});
