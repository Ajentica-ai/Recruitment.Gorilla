import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import DashboardPage from './DashboardPage';
import * as api from '../services/api';
import { renderWithProviders } from '../test/renderWithProviders';
import type { DashboardKpis } from '../types';

const auth = vi.hoisted(() => ({
  user: { name: 'Demo Recruiter' },
  canWriteCandidates: true,
  isAdminOrAbove: false,
}));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => auth }));
// The Insights chart reads the theme for its Recharts colours.
vi.mock('../theme/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));

vi.mock('../services/api', () => ({
  getDashboardKpis: vi.fn(),
  getStatusBreakdown: vi.fn(),
  getApplicationsTrend: vi.fn(),
  getApplicationsSummary: vi.fn(),
  getJobOpenings: vi.fn(),
  getActiveRoleOptions: vi.fn(),
  getDashboard: vi.fn(),
  getOfferMetrics: vi.fn(),
  getMyInterviews: vi.fn(),
  getNotifications: vi.fn(),
}));

const kpis: DashboardKpis = {
  totalCandidates: 82,
  inProcess: 78,
  recommended: 3,
  rejected: 1,
  newThisWeek: 16,
  referredCount: 2,
  referredPercent: 2.4,
  newPrevWeek: 13,
  recommendedThisWeek: 1,
  rejectedThisWeek: 1,
};

const as = (role: 'Interviewer' | 'Recruiter' | 'Admin') => {
  auth.canWriteCandidates = role !== 'Interviewer';
  auth.isAdminOrAbove = role === 'Admin';
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getDashboardKpis).mockResolvedValue(kpis);
  vi.mocked(api.getStatusBreakdown).mockResolvedValue([
    { status: 'Uploaded', count: 72, sortOrder: 1 },
    { status: 'Interview Scheduled', count: 10, sortOrder: 5 },
  ]);
  vi.mocked(api.getApplicationsTrend).mockResolvedValue([
    { date: '2026-10-09', count: 4 },
    { date: '2026-10-10', count: 12 },
  ]);
  vi.mocked(api.getApplicationsSummary).mockResolvedValue({ days: 30, total: 16, previousTotal: 13 });
  vi.mocked(api.getJobOpenings).mockResolvedValue([]);
  vi.mocked(api.getActiveRoleOptions).mockResolvedValue([{ id: 5, name: 'QA Engineer' }] as never);
  vi.mocked(api.getDashboard).mockResolvedValue({ byRole: [], topSkills: [], upcomingInterviews: [], recentActivity: [] });
  vi.mocked(api.getOfferMetrics).mockResolvedValue({
    totalOffers: 0, activeOffers: 0, acceptedOffers: 0, declinedOffers: 0, totalHired: 0, acceptanceRatePercentage: 0,
  });
  vi.mocked(api.getMyInterviews).mockResolvedValue([]);
  vi.mocked(api.getNotifications).mockResolvedValue({ items: [], unreadCount: 0 });
});

describe('DashboardPage', () => {
  it('Interviewer: figures without drill-through, no Team toggle, no My pipeline, no upload button', async () => {
    as('Interviewer');
    renderWithProviders(<DashboardPage />);

    const figures = await screen.findByRole('group', { name: 'Pipeline figures' });
    expect(within(figures).queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryByRole('radio', { name: 'Team' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My pipeline' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Upload CVs' })).not.toBeInTheDocument();
    expect(api.getDashboard).not.toHaveBeenCalled();
    expect(api.getOfferMetrics).not.toHaveBeenCalled();
  });

  it('Recruiter: drill-through tiles, Team toggle, role filter, activity links to candidates', async () => {
    as('Recruiter');
    renderWithProviders(<DashboardPage />);

    const figures = await screen.findByRole('group', { name: 'Pipeline figures' });
    expect(within(figures).getByRole('link', { name: /^New this week: 16, up 3 vs last week/ }))
      .toHaveAttribute('href', '/candidates?bucket=new-this-week');
    expect(screen.getByRole('radio', { name: 'Team' })).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: 'Role' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent activity' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'View all' }).map((l) => l.getAttribute('href'))).toContain('/candidates');
    expect(screen.getAllByRole('link', { name: 'Upload CVs' }).length).toBeGreaterThan(0);
  });

  it('Admin: no role filter, activity "View all" goes to the audit log', async () => {
    as('Admin');
    renderWithProviders(<DashboardPage />);

    await screen.findByRole('group', { name: 'Pipeline figures' });
    expect(screen.queryByRole('combobox', { name: 'Role' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'View all' }).map((l) => l.getAttribute('href'))).toContain('/audit');
    expect(api.getActiveRoleOptions).not.toHaveBeenCalled();
  });

  it('shows the applications total against the prior period', async () => {
    as('Admin');
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('new in the last 30 days')).toBeInTheDocument();
    expect(screen.getByText(/vs prior 30 days/)).toHaveTextContent('3 vs prior 30 days');
  });

  it('refresh re-fetches every dashboard query', async () => {
    as('Recruiter');
    const { queryClient } = renderWithProviders(<DashboardPage />);
    await screen.findByRole('group', { name: 'Pipeline figures' });
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(screen.getByRole('button', { name: 'Refresh dashboard figures' }));

    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['my-interviews'] });
  });
});
