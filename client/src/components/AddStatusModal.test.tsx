import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import AddStatusModal from './AddStatusModal';
import {
  addStatus,
  getNextStatusOptions,
  getAssignableUsers,
  getActiveInterviewTypes,
  getEvaluationShareOptions,
} from '../services/api';

vi.mock('../services/api', () => ({
  addStatus: vi.fn(),
  getNextStatusOptions: vi.fn(),
  getAssignableUsers: vi.fn(),
  getActiveInterviewTypes: vi.fn(),
  getEvaluationShareOptions: vi.fn(),
}));

describe('AddStatusModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEvaluationShareOptions).mockResolvedValue({ interviews: [], users: [], earlierRoundsWithEvaluations: 0 });
    vi.mocked(getNextStatusOptions).mockResolvedValue([
      { id: 9, name: 'Recommended', sortOrder: 11, isInitial: false },
    ]);
    vi.mocked(getAssignableUsers).mockResolvedValue([]);
    vi.mocked(getActiveInterviewTypes).mockResolvedValue([]);
    vi.mocked(addStatus).mockResolvedValue({} as never);
  });

  it('invalidates the dashboard queries after a successful status change', async () => {
    // Regression test for RG-75: the dashboard's KPI tiles (e.g. "Recommended") are keyed off
    // Candidate.CurrentStatus, but this mutation never told them to refetch, so they went stale
    // after a status change until a hard reload.
    const user = userEvent.setup();
    const onAdded = vi.fn();
    const { queryClient } = renderWithProviders(
      <AddStatusModal
        candidateId={42}
        candidateName="Jane Doe"
        initialStatus="Recommended"
        show
        onHide={vi.fn()}
        onAdded={onAdded}
      />,
    );
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await screen.findByDisplayValue('Recommended');
    await user.click(screen.getByRole('button', { name: /save status/i }));

    await waitFor(() => expect(onAdded).toHaveBeenCalled());

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    // Unchanged behavior, kept as a guard against the fix accidentally dropping an existing key.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['candidates'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['candidate', 42] });
  });

  it('submits the status change with the expected payload', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AddStatusModal
        candidateId={42}
        initialStatus="Recommended"
        show
        onHide={vi.fn()}
        onAdded={vi.fn()}
      />,
    );

    await screen.findByDisplayValue('Recommended');
    await user.click(screen.getByRole('button', { name: /save status/i }));

    await waitFor(() => {
      expect(addStatus).toHaveBeenCalledWith(42, expect.objectContaining({ status: 'Recommended' }));
    });
  });

  describe('sharing earlier rounds when booking an interview (#187)', () => {
    const box = () => screen.findByRole('checkbox', { name: /Share earlier rounds/ });

    beforeEach(() => {
      vi.mocked(getAssignableUsers).mockResolvedValue([{ id: 11, name: 'Ivy Interviewer', email: 'ivy@test.local' }]);
    });

    const withEarlierRounds = (count: number) =>
      vi.mocked(getEvaluationShareOptions).mockResolvedValue({
        interviews: [], users: [], earlierRoundsWithEvaluations: count,
      });

    const renderBooking = (status = 'Interview Scheduled') =>
      renderWithProviders(
        <AddStatusModal candidateId={42} initialStatus={status} show onHide={vi.fn()} onAdded={vi.fn()} />,
      );

    /** Fills the required booking fields: a future date and one interviewer. */
    const fillBooking = async (container: HTMLElement) => {
      const date = container.ownerDocument.querySelector('input[type="date"]') as HTMLInputElement;
      fireEvent.change(date, { target: { value: '2031-06-01' } });
      fireEvent.focus(await screen.findByPlaceholderText('Search users to assign…'));
      fireEvent.mouseDown(await screen.findByRole('option', { name: /Ivy Interviewer/ }));
    };

    it('shows the box, unchecked, only when an earlier round has a submitted evaluation', async () => {
      withEarlierRounds(1);
      const { unmount } = renderBooking();
      expect(await box()).not.toBeChecked();
      unmount();

      withEarlierRounds(0);
      renderBooking();
      await screen.findByText(/Interview date\/time/);
      expect(screen.queryByRole('checkbox', { name: /Share earlier rounds/ })).not.toBeInTheDocument();
    });

    it('does not show it for any other status, and does not even ask', async () => {
      withEarlierRounds(3);
      renderBooking('Recommended');

      await screen.findByDisplayValue('Recommended');
      expect(screen.queryByRole('checkbox', { name: /Share earlier rounds/ })).not.toBeInTheDocument();
      expect(getEvaluationShareOptions).not.toHaveBeenCalled();
    });

    it('books without sharing by default, and with sharing once it is ticked', async () => {
      withEarlierRounds(1);
      const { container } = renderBooking();
      await box();
      await fillBooking(container);

      await userEvent.click(screen.getByRole('button', { name: /save status/i }));
      await waitFor(() => expect(addStatus).toHaveBeenCalledTimes(1));
      expect(vi.mocked(addStatus).mock.calls[0][1]).toMatchObject({
        status: 'Interview Scheduled', interviewerUserIds: [11], shareEarlierRoundsWithPanel: false,
      });
    });

    it('sends true when the recruiter ticks it', async () => {
      withEarlierRounds(1);
      const { container } = renderBooking();
      await userEvent.click(await box());
      await fillBooking(container);

      await userEvent.click(screen.getByRole('button', { name: /save status/i }));

      await waitFor(() => expect(addStatus).toHaveBeenCalledTimes(1));
      expect(vi.mocked(addStatus).mock.calls[0][1]).toMatchObject({ shareEarlierRoundsWithPanel: true });
    });
  });
});
