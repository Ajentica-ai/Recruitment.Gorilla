import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import MyInterviewsPage from './MyInterviewsPage';
import { getMyInterviewHistory } from '../services/api';
import type { MyInterviewHistory, MyInterviewHistoryRow } from '../types';

vi.mock('../services/api', () => ({ getMyInterviewHistory: vi.fn() }));

const row = (over: Partial<MyInterviewHistoryRow> = {}): MyInterviewHistoryRow => ({
  id: 11, candidateId: 1, candidateName: 'Ada Lovelace', role: 'Backend Engineer',
  scheduledAt: '2026-10-20T10:00:00Z', status: 'Scheduled', evaluationState: 'None',
  recommendation: null, overallRating: null, ...over,
});

const page = (items: MyInterviewHistoryRow[], over: Partial<MyInterviewHistory> = {}): MyInterviewHistory => ({
  items, totalCount: items.length, page: 1, pageSize: 20,
  counts: { upcoming: 2, awaiting: 3, submitted: 4, cancelled: 1 }, ...over,
});

const renderAt = (url = '/my-interviews') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <MyInterviewsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('MyInterviewsPage (#203)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens on Upcoming and shows the count of every tab on its label', async () => {
    vi.mocked(getMyInterviewHistory).mockResolvedValue(page([row()]));
    renderAt();

    expect(await screen.findByRole('tab', { name: 'Upcoming (2)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Awaiting evaluation (3)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Submitted (4)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Cancelled (1)' })).toBeInTheDocument();
    expect(getMyInterviewHistory).toHaveBeenCalledWith(expect.objectContaining({ tab: 'upcoming', page: 1 }));
  });

  it('links each row to its interview and shows the role', async () => {
    vi.mocked(getMyInterviewHistory).mockResolvedValue(page([row({ id: 42, candidateName: 'Grace Hopper', role: null })]));
    renderAt();

    const link = await screen.findByRole('link', { name: 'Grace Hopper' });
    expect(link).toHaveAttribute('href', '/interviews/42');
    expect(screen.getByText('No role')).toBeInTheDocument();
  });

  it('shows the recommendation and rating the user gave on a submitted interview', async () => {
    vi.mocked(getMyInterviewHistory).mockResolvedValue(page([
      row({ id: 7, evaluationState: 'Submitted', recommendation: 'Recommended', overallRating: 4 }),
    ]));
    renderAt('/my-interviews?tab=submitted');

    expect(await screen.findByText('Recommended')).toBeInTheDocument();
    expect(screen.getByLabelText('Overall rating 4 out of 5')).toHaveTextContent('4/5');
    expect(getMyInterviewHistory).toHaveBeenCalledWith(expect.objectContaining({ tab: 'submitted' }));
  });

  it('marks a draft, an unstarted evaluation and a cancelled interview differently', async () => {
    vi.mocked(getMyInterviewHistory).mockResolvedValue(page([
      row({ id: 1, candidateName: 'Has Draft', evaluationState: 'Draft' }),
      row({ id: 2, candidateName: 'Not Started', evaluationState: 'None' }),
      row({ id: 3, candidateName: 'Was Cancelled', status: 'Cancelled' }),
    ]));
    renderAt('/my-interviews?tab=awaiting');

    const rowFor = async (name: string) => (await screen.findByRole('link', { name })).closest('tr')!;
    expect(within(await rowFor('Has Draft')).getByText('Draft')).toBeInTheDocument();
    expect(within(await rowFor('Not Started')).getByText('Not started')).toBeInTheDocument();
    expect(within(await rowFor('Was Cancelled')).getByText('Cancelled')).toBeInTheDocument();
  });

  it('asks for another tab when it is clicked, back on page one', async () => {
    vi.mocked(getMyInterviewHistory).mockResolvedValue(page([row()]));
    renderAt('/my-interviews?page=3');
    await screen.findByRole('tab', { name: 'Upcoming (2)' });

    await userEvent.click(screen.getByRole('tab', { name: 'Cancelled (1)' }));

    expect(getMyInterviewHistory).toHaveBeenLastCalledWith(expect.objectContaining({ tab: 'cancelled', page: 1 }));
  });

  it('searches by candidate name and resets to the first page', async () => {
    vi.mocked(getMyInterviewHistory).mockResolvedValue(page([row()]));
    renderAt('/my-interviews?page=2');
    await screen.findByRole('tab', { name: 'Upcoming (2)' });

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search my interviews' }), 'lovelace{Enter}');

    expect(getMyInterviewHistory).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'lovelace', page: 1 }));
  });

  it('says what is empty on a tab, and when a search matched nothing', async () => {
    vi.mocked(getMyInterviewHistory).mockResolvedValue(page([]));
    const { unmount } = renderAt('/my-interviews?tab=awaiting');
    expect(await screen.findByText('Nothing waiting on you')).toBeInTheDocument();
    unmount();

    renderAt('/my-interviews?tab=submitted&q=zzz');
    expect(await screen.findByText('No interviews match your search')).toBeInTheDocument();
  });

  it('shows an error panel when the history cannot be loaded', async () => {
    vi.mocked(getMyInterviewHistory).mockRejectedValue(new Error('boom'));
    renderAt();

    expect(await screen.findByText('Could not load your interviews')).toBeInTheDocument();
  });

  it('reports the total across pages', async () => {
    vi.mocked(getMyInterviewHistory).mockResolvedValue(page([row()], { totalCount: 45 }));
    renderAt();

    expect(await screen.findByText('45 interviews')).toBeInTheDocument();
  });
});
