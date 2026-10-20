import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import EvaluationSharesList from './EvaluationSharesList';
import { getEvaluationShares, revokeEvaluationShare } from '../services/api';
import type { EvaluationShare } from '../types';

vi.mock('../services/api', () => ({
  getEvaluationShares: vi.fn(),
  revokeEvaluationShare: vi.fn(),
}));

const share = (over: Partial<EvaluationShare> = {}): EvaluationShare => ({
  id: 1,
  candidateId: 42,
  interviewId: null,
  interviewScheduledAt: null,
  granteeUserId: 5,
  granteeName: 'Ivy Interviewer',
  granteeEmail: 'ivy@test.local',
  source: 'Manual',
  note: null,
  expiresAt: null,
  isActive: true,
  grantedByUserId: 1,
  grantedByName: 'Rita Recruiter',
  createdAt: '2026-10-20T08:00:00Z',
  revokedAt: null,
  revokedByUserId: null,
  revokedByName: null,
  ...over,
});

describe('EvaluationSharesList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(revokeEvaluationShare).mockResolvedValue();
  });

  it('lists active shares with scope, source and who granted them, and collapses the rest', async () => {
    vi.mocked(getEvaluationShares).mockResolvedValue([
      share({ id: 1, source: 'PanelAutoShare', note: 'round 1 panel' }),
      share({ id: 2, granteeName: 'Old Grantee', revokedAt: '2026-10-19T00:00:00Z', isActive: false }),
      share({ id: 3, granteeName: 'Lapsed Grantee', expiresAt: '2026-10-01T00:00:00Z', isActive: false }),
    ]);
    renderWithProviders(<EvaluationSharesList candidateId={42} />);

    const active = await screen.findByLabelText('Active shares');
    expect(active).toHaveTextContent('Ivy Interviewer');
    expect(active).toHaveTextContent('All rounds');
    expect(active).toHaveTextContent('Auto: panel');
    expect(active).toHaveTextContent('by Rita Recruiter');
    expect(active).toHaveTextContent('No expiry');
    expect(active).toHaveTextContent('Note: round 1 panel');

    // Revoked and expired rows are history: hidden until asked for.
    expect(screen.queryByText('Old Grantee')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /revoked and expired \(2\)/ }));
    const history = screen.getByLabelText('Revoked and expired shares');
    expect(within(history).getByText('Old Grantee')).toBeInTheDocument();
    expect(within(history).getByText('Revoked')).toBeInTheDocument();
    expect(within(history).getByText('Expired')).toBeInTheDocument();
    // No Revoke button on a row that is already over.
    expect(within(history).queryByRole('button', { name: /Revoke/ })).not.toBeInTheDocument();
  });

  it('says so when nothing is shared', async () => {
    vi.mocked(getEvaluationShares).mockResolvedValue([]);
    renderWithProviders(<EvaluationSharesList candidateId={42} />);
    expect(await screen.findByText('Not shared with anyone yet.')).toBeInTheDocument();
  });

  it('asks before revoking, and Cancel revokes nothing', async () => {
    vi.mocked(getEvaluationShares).mockResolvedValue([share()]);
    renderWithProviders(<EvaluationSharesList candidateId={42} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Revoke Ivy Interviewer' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Ivy Interviewer will lose access');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(revokeEvaluationShare).not.toHaveBeenCalled();
  });

  it('revokes the right share on confirm and refreshes the list', async () => {
    vi.mocked(getEvaluationShares).mockResolvedValue([share({ id: 9 })]);
    const { queryClient } = renderWithProviders(<EvaluationSharesList candidateId={42} />);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await userEvent.click(await screen.findByRole('button', { name: 'Revoke Ivy Interviewer' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Revoke' }));

    await waitFor(() => expect(revokeEvaluationShare).toHaveBeenCalledWith(42, 9));
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['evaluation-shares', 42] }),
    );
    expect(await screen.findByText('Stopped sharing with Ivy Interviewer.')).toBeInTheDocument();
  });

  it("shows the server's message inside the dialog when the revoke fails", async () => {
    vi.mocked(getEvaluationShares).mockResolvedValue([share()]);
    vi.mocked(revokeEvaluationShare).mockRejectedValue({ response: { data: 'Not allowed.' } });
    renderWithProviders(<EvaluationSharesList candidateId={42} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Revoke Ivy Interviewer' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Revoke' }));

    expect(await within(await screen.findByRole('dialog')).findByText('Not allowed.')).toBeInTheDocument();
  });
});
