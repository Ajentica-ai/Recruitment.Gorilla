import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import SharedWithMeCard from './SharedWithMeCard';
import { getSharedWithMe } from '../../services/api';
import type { SharedEvaluationSummary } from '../../types';

vi.mock('../../services/api', () => ({ getSharedWithMe: vi.fn() }));

const share = (over: Partial<SharedEvaluationSummary> = {}): SharedEvaluationSummary => ({
  candidateId: 42,
  candidateName: 'Jane Doe',
  roleApplied: 'QA Engineer',
  allRounds: true,
  interviews: [],
  grantedByName: 'Rita Recruiter',
  note: null,
  expiresAt: null,
  visibleEvaluationCount: 2,
  ...over,
});

describe('SharedWithMeCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing when nothing is shared', async () => {
    vi.mocked(getSharedWithMe).mockResolvedValue([]);
    renderWithProviders(<SharedWithMeCard />);

    await waitFor(() => expect(getSharedWithMe).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Shared with me' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders nothing when the request fails', async () => {
    vi.mocked(getSharedWithMe).mockRejectedValue(new Error('boom'));
    renderWithProviders(<SharedWithMeCard />);

    await waitFor(() => expect(getSharedWithMe).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Shared with me' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('lists each shared candidate with who shared it, the expiry and the readable count', async () => {
    vi.mocked(getSharedWithMe).mockResolvedValue([
      share({ expiresAt: '2026-11-03T12:00:00Z' }),
      share({ candidateId: 43, candidateName: 'Sam Lee', visibleEvaluationCount: 1, grantedByName: null }),
    ]);
    renderWithProviders(<SharedWithMeCard />);

    const jane = await screen.findByRole('link', { name: /Jane Doe/ });
    expect(jane).toHaveAttribute('href', '/shared/candidates/42/evaluations');
    expect(jane).toHaveTextContent('QA Engineer');
    expect(jane).toHaveTextContent('by Rita Recruiter');
    expect(jane).toHaveTextContent(/until .*2026/);
    expect(jane).toHaveTextContent('2 evaluations');

    const sam = screen.getByRole('link', { name: /Sam Lee/ });
    expect(sam).toHaveAttribute('href', '/shared/candidates/43/evaluations');
    expect(sam).toHaveTextContent('1 evaluation');
    expect(sam).not.toHaveTextContent('by ');
  });
});
