import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import UpNextCard from './UpNextCard';
import { mineGroups } from './upNextGroups';
import * as api from '../../services/api';
import { renderWithProviders } from '../../test/renderWithProviders';
import type { MyInterview, UpcomingInterview } from '../../types';

vi.mock('../../services/api', () => ({ getMyInterviews: vi.fn() }));

const HOUR = 3600 * 1000;
const at = (ms: number) => new Date(Date.now() + ms).toISOString();

const mine: MyInterview[] = [
  { id: 101, candidateId: 1, candidateName: 'Alex Rivera', role: 'Backend Engineer', scheduledAt: at(-48 * HOUR), evaluationState: 'Draft' },
  { id: 102, candidateId: 2, candidateName: 'Sarah Connor', role: 'DevOps Lead', scheduledAt: at(-72 * HOUR), evaluationState: 'Submitted' },
  { id: 103, candidateId: 3, candidateName: 'Md Rifat Hossen', role: null, scheduledAt: at(30 * 24 * HOUR), evaluationState: 'None' },
];

const team: UpcomingInterview[] = [
  { candidateId: 9, fullName: 'Nusrat Jahan', role: 'Frontend Engineer', currentStatus: 'Interview Scheduled', interviewAt: at(26 * HOUR) },
];

describe('mineGroups', () => {
  it('puts past interviews owing an evaluation first, drops submitted ones, then groups upcoming by day', () => {
    const now = new Date(2026, 9, 10, 13, 0);
    const list: MyInterview[] = [
      { ...mine[0], scheduledAt: new Date(2026, 9, 9, 10, 0).toISOString() },
      { ...mine[1], scheduledAt: new Date(2026, 9, 8, 10, 0).toISOString() },
      { ...mine[2], id: 201, scheduledAt: new Date(2026, 9, 10, 15, 0).toISOString() },
      { ...mine[2], id: 202, scheduledAt: new Date(2026, 9, 11, 9, 30).toISOString() },
      { ...mine[2], id: 203, scheduledAt: new Date(2026, 9, 10, 16, 30).toISOString() },
    ];

    const groups = mineGroups(list, now);

    expect(groups.map((g) => g.label)).toEqual(['Awaiting evaluation', 'Today', 'Tomorrow']);
    expect(groups[0].rows.map((r) => r.href)).toEqual(['/interviews/101']);
    expect(groups[1].rows.map((r) => r.href)).toEqual(['/interviews/201', '/interviews/203']);
    expect(groups[1].rows[0].when).toBe('in 2h');
    expect(groups[1].rows[0].soon).toBe(true);
  });
});

describe('UpNextCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows one slim line, not a full empty state, when nothing is scheduled', async () => {
    vi.mocked(api.getMyInterviews).mockResolvedValue([]);
    renderWithProviders(<UpNextCard />);
    expect(await screen.findByText('Nothing scheduled.')).toBeInTheDocument();
  });

  it('has no Mine/Team toggle for a role without a team list', async () => {
    vi.mocked(api.getMyInterviews).mockResolvedValue(mine);
    renderWithProviders(<UpNextCard />);
    await screen.findByText('Alex Rivera');
    expect(screen.queryByRole('radio', { name: 'Team' })).not.toBeInTheDocument();
  });

  it('deep-links each row and the awaiting-evaluation badge to the interview', async () => {
    vi.mocked(api.getMyInterviews).mockResolvedValue(mine);
    renderWithProviders(<UpNextCard team={[]} />);

    expect(await screen.findByRole('link', { name: /^Alex Rivera/ })).toHaveAttribute('href', '/interviews/101');
    expect(screen.getByRole('link', { name: /^Md Rifat Hossen/ })).toHaveAttribute('href', '/interviews/103');
    expect(screen.queryByText('Sarah Connor')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '1 awaiting evaluation' })).toHaveAttribute('href', '/interviews/101');
  });

  it('switches to the team list, which links to the candidate', async () => {
    vi.mocked(api.getMyInterviews).mockResolvedValue(mine);
    renderWithProviders(<UpNextCard team={team} />);
    await screen.findByText('Alex Rivera');

    fireEvent.click(screen.getByRole('radio', { name: 'Team' }));

    expect(screen.getByRole('link', { name: /^Nusrat Jahan/ })).toHaveAttribute('href', '/candidates/9');
    expect(screen.queryByText('Alex Rivera')).not.toBeInTheDocument();
    expect(screen.getByText('Interviews across your candidates.')).toBeInTheDocument();
  });
});
