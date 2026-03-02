import { EditorShortcutAction } from './types';

interface EditorShortcutKeyInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export function resolveEditorShortcutAction({
  key,
  ctrlKey,
  metaKey,
  shiftKey,
}: EditorShortcutKeyInput): EditorShortcutAction {
  if ((ctrlKey || metaKey) && key === 'Enter') {
    return { type: 'confirm' };
  }

  if (!(ctrlKey || metaKey) || !shiftKey) {
    return null;
  }

  if (key === '0' || key === ')') {
    return { type: 'insertAllTags' };
  }

  if (/^[1-9]$/.test(key)) {
    return { type: 'insertTag', tagIndex: Number.parseInt(key, 10) - 1 };
  }

  return null;
}

export type { EditorShortcutKeyInput };
