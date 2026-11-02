import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from './ToastStack';

function TwoToastTrigger() {
  const { addToast } = useToast();
  return (
    <button
      onClick={() => {
        addToast('First toast');
        addToast('Second toast');
      }}
    >
      Add two
    </button>
  );
}

describe('ToastStack', () => {
  it('keeps both toasts when two are added in the same tick', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TwoToastTrigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Add two' }));

    expect(screen.getByText('First toast')).toBeInTheDocument();
    expect(screen.getByText('Second toast')).toBeInTheDocument();
  });

  it('dismisses only the toast whose close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TwoToastTrigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Add two' }));

    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    await user.click(closeButtons[0]);

    expect(screen.queryByText('First toast')).not.toBeInTheDocument();
    expect(screen.getByText('Second toast')).toBeInTheDocument();
  });
});
