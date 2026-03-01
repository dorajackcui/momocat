import { describe, expect, it } from 'vitest';
import { resolveEditorRowShortcutAction } from './useEditorRowCommandHandlers';

describe('useEditorRowCommandHandlers.resolveEditorRowShortcutAction', () => {
  it('returns null for unrelated shortcuts', () => {
    expect(
      resolveEditorRowShortcutAction({
        key: 'a',
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      }),
    ).toBeNull();

    expect(
      resolveEditorRowShortcutAction({
        key: '1',
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
      }),
    ).toBeNull();
  });

  it('returns confirm for command/ctrl + enter', () => {
    expect(
      resolveEditorRowShortcutAction({
        key: 'Enter',
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
      }),
    ).toEqual({ type: 'confirm' });
  });

  it('returns insert all tags for command/ctrl + shift + 0/)', () => {
    expect(
      resolveEditorRowShortcutAction({
        key: '0',
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
      }),
    ).toEqual({ type: 'insertAllTags' });

    expect(
      resolveEditorRowShortcutAction({
        key: ')',
        ctrlKey: false,
        metaKey: true,
        shiftKey: true,
      }),
    ).toEqual({ type: 'insertAllTags' });
  });

  it('returns insert tag for command/ctrl + shift + 1..9', () => {
    expect(
      resolveEditorRowShortcutAction({
        key: '1',
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
      }),
    ).toEqual({ type: 'insertTag', tagIndex: 0 });

    expect(
      resolveEditorRowShortcutAction({
        key: '9',
        ctrlKey: false,
        metaKey: true,
        shiftKey: true,
      }),
    ).toEqual({ type: 'insertTag', tagIndex: 8 });
  });
});
