import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import AddStatusModal from './AddStatusModal';
import { addStatus, getNextStatusOptions, getAssignableUsers, getActiveInterviewTypes } from '../services/api';

vi.mock('../services/api', () => ({
  addStatus: vi.fn(),
  getNextStatusOptions: vi.fn(),
  getAssignableUsers: vi.fn(),
  getActiveInterviewTypes: vi.fn(),
}));

describe('AddStatusModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
