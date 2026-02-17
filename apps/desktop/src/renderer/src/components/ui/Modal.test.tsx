import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  test('does not render when closed', () => {
    render(
      <Modal open={false} title="Dialog">
        hidden
      </Modal>,
    );
    expect(screen.queryByText('Dialog')).toBeNull();
  });

  test('renders content when open', () => {
    render(
      <Modal open={true} title="Dialog">
        <div>Body</div>
      </Modal>,
    );
    expect(screen.getByText('Dialog')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  test('calls onClose on backdrop click', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open={true} title="Dialog" onClose={onClose}>
        Body
      </Modal>,
    );
    const backdrop = container.querySelector('.modal-backdrop');
    if (!backdrop) {
      throw new Error('Expected modal backdrop');
    }
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
