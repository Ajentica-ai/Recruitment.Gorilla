import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import AnalyticsPage from './AnalyticsPage';
import type { RecruitingAnalyticsSummary } from '../types';

vi.mock('../services/api', () => ({
  getRecruitingAnalytics: vi.fn(),
  getCandidateFilterRoleOptions: vi.fn().mockResolvedValue([
    { id: 1, name: 'Backend Engineer', isActive: true },
    { id: 2, name: 'Frontend Engineer', isActive: true },
  ]),
}));

import { getRecruitingAnalytics } from '../services/api';

const mockSummary: RecruitingAnalyticsSummary = {
  timeToHire: {
    averageDays: 14.5,
    medianDays: 12.0,
    fastestDays: 5,
    longestDays: 24,
    totalHires: 4,
    changeVsPreviousPeriodPercent: -10.5,
  },
  averagePipelineDays: 3.2,
  overallFunnelConversionRate: 8.5,
  totalCandidatesInPeriod: 48,
  activeCandidates: 16,
  funnelStages: [
    {
      stageKey: 'Applied',
      stageName: '1. Applied / Uploaded',
      stepNumber: 1,
      totalEntered: 48,
      conversionFromStartPercent: 100.0,
      conversionFromPreviousPercent: 100.0,
      dropoffCount: 0,
    },
    {
      stageKey: 'Assessment',
      stageName: '2. Screening & Assessment',
      stepNumber: 2,
      totalEntered: 28,
      conversionFromStartPercent: 58.3,
      conversionFromPreviousPercent: 58.3,
      dropoffCount: 20,
    },
    {
      stageKey: 'Interview',
      stageName: '3. Interview Stages',
      stepNumber: 3,
      totalEntered: 14,
      conversionFromStartPercent: 29.2,
      conversionFromPreviousPercent: 50.0,
      dropoffCount: 14,
    },
    {
      stageKey: 'Offer',
      stageName: '4. Offer Extended',
      stepNumber: 4,
      totalEntered: 6,
      conversionFromStartPercent: 12.5,
      conversionFromPreviousPercent: 42.9,
      dropoffCount: 8,
    },
    {
      stageKey: 'Hired',
      stageName: '5. Hired / Accepted',
      stepNumber: 5,
      totalEntered: 4,
      conversionFromStartPercent: 8.3,
      conversionFromPreviousPercent: 66.7,
      dropoffCount: 2,
    },
  ],
  stageVelocities: [
    {
      stageName: 'Interview Scheduled',
      sortOrder: 1,
      averageDays: 4.8,
      medianDays: 4.0,
      candidatesCount: 14,
    },
    {
      stageName: 'Technical Assessment',
      sortOrder: 2,
      averageDays: 3.2,
      medianDays: 3.0,
      candidatesCount: 28,
    },
  ],
  sourcingChannels: [
    {
      sourceId: 3,
      sourceName: 'LinkedIn',
      totalApplicants: 24,
      screenedCount: 16,
      interviewedCount: 8,
      offeredCount: 4,
      hiredCount: 3,
      conversionToHirePercent: 12.5,
      shareOfTotalHiresPercent: 75.0,
    },
  ],
  recruiterWorkloads: [
    {
      recruiterUserId: 10,
      recruiterName: 'Sarah Connor',
      activeCandidates: 8,
      totalAssigned: 20,
      transitionsLogged: 34,
      interviewsParticipated: 6,
      hiresMade: 3,
    },
  ],
  periodStart: '2026-08-01T00:00:00Z',
  periodEnd: '2026-08-31T00:00:00Z',
};

const renderWithClient = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AnalyticsPage />
    </QueryClientProvider>
  );
};

describe('AnalyticsPage', () => {
  it('renders operational analytics summary with KPI metrics and charts', async () => {
    vi.mocked(getRecruitingAnalytics).mockResolvedValue(mockSummary);

    renderWithClient();

    expect(screen.getByRole('status', { name: /Calculating recruitment analytics/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('14.5 days')).toBeInTheDocument();
      expect(screen.getByText('Pipeline funnel')).toBeInTheDocument();
      expect(screen.getByText('Stage dwell time')).toBeInTheDocument();
      expect(screen.getByText('Sourcing Channel Performance & ROI')).toBeInTheDocument();
      expect(screen.getByText('Recruiter Productivity & Pipeline Workload')).toBeInTheDocument();
    });

    expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn')).toBeInTheDocument();
  });

  it('triggers query update when changing date preset', async () => {
    const user = userEvent.setup();
    vi.mocked(getRecruitingAnalytics).mockResolvedValue(mockSummary);

    renderWithClient();

    await waitFor(() => {
      expect(screen.getByText('14.5 days')).toBeInTheDocument();
    });

    const preset7d = screen.getByRole('button', { name: '7 Days' });
    await user.click(preset7d);

    expect(getRecruitingAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ preset: '7d' })
    );
  });
});
