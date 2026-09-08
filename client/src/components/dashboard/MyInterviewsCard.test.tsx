import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyInterviewsCard from './MyInterviewsCard';
import * as api from '../../services/api';
import type { MyInterview } from '../../types';

vi.mock('../../services/api', () => ({
  getMyInterviews: vi.fn(),
}));

const mockInterviews: MyInterview[] = [
  {
    id: 101,
    candidateId: 1,
    candidateName: 'Alex Rivera',
    role: 'Backend Engineer',
    scheduledAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    evaluationState: 'None',
  },
  {
    id: 102,
    candidateId: 2,
    candidateName: 'Md Rifat Hossen',
    role: 'Full Stack Engineer',
    scheduledAt: new Date(Date.now() + 7200 * 1000).toISOString(),
    evaluationState: 'None',
  },
  {
    id: 103,
    candidateId: 3,
    candidateName: 'Sarah Connor',
    role: 'DevOps Lead',
    scheduledAt: new Date(Date.now() + 86400 * 1000).toISOString(),
    evaluationState: 'Draft',
  },
  {
    id: 104,
    candidateId: 4,
    candidateName: 'David Miller',
    role: 'Product Designer',
    scheduledAt: new Date(Date.now() + 90000 * 1000).toISOString(),
    evaluationState: 'Submitted',
  },
];

const renderComponent = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MyInterviewsCard />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('MyInterviewsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when there are no assigned interviews', async () => {
    vi.mocked(api.getMyInterviews).mockResolvedValueOnce([]);
    renderComponent();

    expect(await screen.findByText(/No assigned interviews/i)).toBeInTheDocument();
  });

  it('renders 2 items with deep links and no toggle button when length <= 2', async () => {
    vi.mocked(api.getMyInterviews).mockResolvedValueOnce(mockInterviews.slice(0, 2));
    renderComponent();

    expect(await screen.findByText('Alex Rivera')).toBeInTheDocument();
    expect(screen.getByText('Md Rifat Hossen')).toBeInTheDocument();
    expect(screen.queryByText(/Show.*more interviews/i)).not.toBeInTheDocument();

    // Verify deep links on rows
    const link1 = screen.getByRole('link', { name: /Alex Rivera/i });
    expect(link1).toHaveAttribute('href', '/interviews/101');
    const link2 = screen.getByRole('link', { name: /Md Rifat Hossen/i });
    expect(link2).toHaveAttribute('href', '/interviews/102');
  });

  it('wraps list to 2 items when more than 2 interviews exist and expands on click', async () => {
    vi.mocked(api.getMyInterviews).mockResolvedValueOnce(mockInterviews);
    renderComponent();

    expect(await screen.findByText('Alex Rivera')).toBeInTheDocument();
    expect(screen.getByText('Md Rifat Hossen')).toBeInTheDocument();
    // 3rd and 4th items should be wrapped / hidden initially
    expect(screen.queryByText('Sarah Connor')).not.toBeInTheDocument();
    expect(screen.queryByText('David Miller')).not.toBeInTheDocument();

    // Toggle button should appear
    const toggleBtn = screen.getByRole('button', { name: /Show 2 more interviews/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(screen.getByText('Showing 2 of 4 interviews')).toBeInTheDocument();

    // Expand
    fireEvent.click(toggleBtn);

    // Now all 4 should be visible
    expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
    expect(screen.getByText('David Miller')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show less/i })).toBeInTheDocument();

    // Deep link on 3rd item
    const link3 = screen.getByRole('link', { name: /Sarah Connor/i });
    expect(link3).toHaveAttribute('href', '/interviews/103');
  });

  it('provides a deep link from the pending evaluation header badge', async () => {
    vi.mocked(api.getMyInterviews).mockResolvedValueOnce(mockInterviews);
    renderComponent();

    const badgeLink = await screen.findByRole('link', { name: /3 awaiting evaluation/i });
    expect(badgeLink).toBeInTheDocument();
    // Links directly to the first pending interview
    expect(badgeLink).toHaveAttribute('href', '/interviews/101');
  });
});
