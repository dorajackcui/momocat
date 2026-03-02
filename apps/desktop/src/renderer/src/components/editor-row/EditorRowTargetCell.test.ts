import React from 'react';
import { describe, expect, it } from 'vitest';
import { EditorRowTargetCell } from './EditorRowTargetCell';

function renderCell(overrides?: Partial<React.ComponentProps<typeof EditorRowTargetCell>>) {
  const props: React.ComponentProps<typeof EditorRowTargetCell> = {
    editorHostRef: { current: null },
    isActive: true,
    ...overrides,
  };
  const element = EditorRowTargetCell(props);
  if (!React.isValidElement(element)) {
    throw new Error('Expected EditorRowTargetCell to return a React element');
  }
  const host = React.Children.toArray(element.props.children)[0] as React.ReactElement;
  return { host };
}

describe('EditorRowTargetCell', () => {
  it('renders codemirror host with editor classes', () => {
    const { host } = renderCell();
    expect(host.props.className).toContain('editor-target-text-layer');
    expect(host.props.className).toContain('editor-target-editor-host');
  });

  it('disables pointer events when row is inactive', () => {
    const { host } = renderCell({ isActive: false });
    expect(host.props.className).toContain('pointer-events-none');
  });
});
