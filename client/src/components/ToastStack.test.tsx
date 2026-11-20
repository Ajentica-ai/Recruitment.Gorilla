import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

  describe('readability (#261)', () => {
    afterEach(() => vi.useRealTimers());

    type Variant = 'success' | 'danger' | 'warning' | 'info';

    function Trigger({ variant }: { variant: Variant }) {
      const { addToast } = useToast();
      return <button onClick={() => addToast('Hello toast', variant)}>Add</button>;
    }

    function show(variant: Variant) {
      render(
        <ToastProvider>
          <Trigger variant={variant} />
        </ToastProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));
      return screen.getByText('Hello toast').closest('[data-variant]') as HTMLElement;
    }

    const gone = () => expect(screen.queryByText('Hello toast')).not.toBeInTheDocument();
    const here = () => expect(screen.queryByText('Hello toast')).toBeInTheDocument();

    it.each(['success', 'danger', 'warning', 'info'] as const)(
      'paints the %s toast on an opaque surface with the tint on top and an accent bar',
      (variant) => {
        const cls = show(variant).className;
        expect(cls).toContain('bg-[var(--surface)]');
        expect(cls).toContain(`bg-[image:linear-gradient(var(--${variant}-tint),var(--${variant}-tint))]`);
        expect(cls).toContain('border-l-4');
        expect(cls).not.toMatch(/bg-(success|danger|warning|info)-muted/);
      },
    );

    it('dismisses a success toast after 4 seconds', () => {
      vi.useFakeTimers();
      show('success');
      act(() => void vi.advanceTimersByTime(3999));
      here();
      act(() => void vi.advanceTimersByTime(2));
      gone();
    });

    it('keeps an error toast on screen for 10 seconds', () => {
      vi.useFakeTimers();
      show('danger');
      act(() => void vi.advanceTimersByTime(9000));
      here();
      act(() => void vi.advanceTimersByTime(1100));
      gone();
    });

    it('does not dismiss a toast while the pointer is over it, then restarts the countdown', () => {
      vi.useFakeTimers();
      const toast = show('success');
      act(() => void vi.advanceTimersByTime(3000));
      fireEvent.mouseEnter(toast);
      act(() => void vi.advanceTimersByTime(20000));
      here();
      fireEvent.mouseLeave(toast);
      act(() => void vi.advanceTimersByTime(3900));
      here();
      act(() => void vi.advanceTimersByTime(200));
      gone();
    });

    it('does not dismiss a toast while focus is inside it', () => {
      vi.useFakeTimers();
      const toast = show('success');
      fireEvent.focusIn(toast);
      act(() => void vi.advanceTimersByTime(20000));
      here();
      fireEvent.focusOut(toast);
      act(() => void vi.advanceTimersByTime(4100));
      gone();
    });
  });
});
