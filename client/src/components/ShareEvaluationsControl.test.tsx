import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import ShareEvaluationsControl from './ShareEvaluationsControl';
import { getEvaluationShares } from '../services/api';
import type { EvaluationShare } from '../types';

const auth = vi.hoisted(() => ({ canWriteCandidates: true }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../services/api', () => ({
  getEvaluationShares: vi.fn(),
  getEvaluationShareOptions: vi.fn().mockResolvedValue({ interviews: [], users: [] }),
  createEvaluationShares: vi.fn(),
  revokeEvaluationShare: vi.fn(),
}));

const share = (over: Partial<EvaluationShare>): EvaluationShare => ({
  id: 1,
  candidateId: 42,
  interviewId: null,
  interviewScheduledAt: null,
  granteeUserId: 5,
  granteeName: 'Ivy',
  granteeEmail: 'ivy@test.local',
  source: 'Manual',
  note: null,
  expiresAt: null,
  isActive: true,
  grantedByUserId: 1,
  grantedByName: 'Rita',
  createdAt: '2026-10-20T08:00:00Z',
  revokedAt: null,
  revokedByUserId: null,
  revokedByName: null,
  ...over,
});

describe('ShareEvaluationsControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.canWriteCandidates = true;
    vi.mocked(getEvaluationShares).mockResolvedValue([]);
  });

  it('is hidden for a role that cannot write candidates, and asks the API nothing', () => {
    auth.canWriteCandidates = false;
    renderWithProviders(<ShareEvaluationsControl candidateId={42} candidateName="Jane" showSummary />);

    expect(screen.queryByRole('button', { name: /Share evaluations/ })).not.toBeInTheDocument();
    expect(getEvaluationShares).not.toHaveBeenCalled();
  });

  it('shows the action without a summary line by default', () => {
    renderWithProviders(<ShareEvaluationsControl candidateId={42} candidateName="Jane" />);

    expect(screen.getByRole('button', { name: /Share evaluations/ })).toBeInTheDocument();
    expect(getEvaluationShares).not.toHaveBeenCalled();
  });

  it('counts distinct people with an active share, ignoring revoked and expired ones', async () => {
    vi.mocked(getEvaluationShares).mockResolvedValue([
      share({ id: 1, granteeUserId: 5 }),
      share({ id: 2, granteeUserId: 5, interviewId: 301 }), // same person, second row
      share({ id: 3, granteeUserId: 6 }),
      share({ id: 4, granteeUserId: 7, isActive: false, revokedAt: '2026-10-19T00:00:00Z' }),
      share({ id: 5, granteeUserId: 8, isActive: false }),
    ]);
    renderWithProviders(<ShareEvaluationsControl candidateId={42} candidateName="Jane" showSummary />);

    expect(await screen.findByRole('button', { name: 'Shared with 2 people' })).toBeInTheDocument();
  });

  it('says so when nobody has it', async () => {
    renderWithProviders(<ShareEvaluationsControl candidateId={42} candidateName="Jane" showSummary />);

    expect(await screen.findByRole('button', { name: 'Not shared with anyone' })).toBeInTheDocument();
  });
});
