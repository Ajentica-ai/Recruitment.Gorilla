import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../components/ToastStack';
import SharedEvaluationsPage from './SharedEvaluationsPage';
import { shareBannerText } from '../lib/evaluationShares';
import { getSharedProfile, getSharedReport, getSharedWithMe } from '../services/api';
import type { CandidateDetail, CandidateEvaluationReport, SharedEvaluationSummary } from '../types';

const auth = vi.hoisted(() => ({ canWriteCandidates: false }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../services/api', () => ({
  getSharedWithMe: vi.fn(),
  getSharedReport: vi.fn(),
  getSharedProfile: vi.fn(),
}));
// The report body and profile are covered elsewhere; here only what the page hands them matters.
vi.mock('../components/EvaluationReportBody', () => ({
  default: ({ data }: { data: CandidateEvaluationReport }) => (
    <div data-testid="report-body">{data.evaluations.length} evaluations</div>
  ),
}));
vi.mock('../components/ReadOnlyCandidateProfile', () => ({
  default: ({ candidate, sharedCv }: { candidate: CandidateDetail; sharedCv?: boolean }) => (
    <div data-testid="profile" data-shared-cv={String(sharedCv)}>
      {candidate.fullName}
    </div>
  ),
}));

const share = (over: Partial<SharedEvaluationSummary> = {}): SharedEvaluationSummary => ({
  candidateId: 42,
  candidateName: 'Jane Doe',
  roleApplied: 'QA Engineer',
  allRounds: true,
  interviews: [],
  grantedByName: 'Rita Recruiter',
  note: 'Round 2 prep',
  expiresAt: null,
  visibleEvaluationCount: 2,
  ...over,
});

const report = (): CandidateEvaluationReport =>
  ({
    candidateId: 42,
    fullName: 'Jane Doe',
    roleApplied: 'QA Engineer',
    summary: { interviewerCount: 2, averageOverall: 4, recommendationCounts: [], criterionAverages: [] },
    evaluations: [{}, {}],
  }) as unknown as CandidateEvaluationReport;

const renderPage = (children: ReactNode = <SharedEvaluationsPage />) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/shared/candidates/42/evaluations']}>
          <Routes>
            <Route path="/shared/candidates/:id/evaluations" element={children} />
            <Route path="/" element={<div>dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
};

const notFound = { isAxiosError: true, response: { status: 404 } };

describe('SharedEvaluationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.canWriteCandidates = false;
    vi.mocked(getSharedWithMe).mockResolvedValue([share()]);
    vi.mocked(getSharedReport).mockResolvedValue(report());
    vi.mocked(getSharedProfile).mockResolvedValue({ id: 42, fullName: 'Jane Doe' } as CandidateDetail);
  });

  it('shows an Interviewer-only user the banner, the note, the report and the profile', async () => {
    renderPage();

    const banner = await screen.findByLabelText('About this share');
    expect(banner).toHaveTextContent('Shared with you by Rita Recruiter');
    expect(banner).toHaveTextContent('All rounds');
    expect(banner).toHaveTextContent('Note: Round 2 prep');
    expect(await screen.findByTestId('report-body')).toHaveTextContent('2 evaluations');
    // The profile reads its CV through the grant-checked endpoint.
    expect(await screen.findByTestId('profile')).toHaveAttribute('data-shared-cv', 'true');
    expect(getSharedReport).toHaveBeenCalledWith(42);
  });

  it('says when the share ends, and omits "until" when it never does', async () => {
    expect(shareBannerText(share({ expiresAt: null }))).toBe('Shared with you by Rita Recruiter');
    expect(shareBannerText(share({ expiresAt: '2026-11-03T12:00:00Z' }))).toMatch(
      /^Shared with you by Rita Recruiter, until .*2026$/,
    );
    expect(shareBannerText(share({ grantedByName: null }))).toBe('Shared with you');
  });

  it('lists how many interviews were shared when it is not every round', async () => {
    vi.mocked(getSharedWithMe).mockResolvedValue([
      share({ allRounds: false, interviews: [{ interviewId: 301, scheduledAt: '2026-11-03T09:00:00Z' }] }),
    ]);
    renderPage();

    expect(await screen.findByLabelText('About this share')).toHaveTextContent('1 interview shared.');
  });

  it('says the share expired or was revoked on a 404, without redirecting', async () => {
    vi.mocked(getSharedWithMe).mockResolvedValue([]);
    vi.mocked(getSharedReport).mockRejectedValue(notFound);
    renderPage();

    expect(await screen.findByText('This share has expired or was revoked')).toBeInTheDocument();
    expect(screen.queryByText('dashboard')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open the evaluation report' })).not.toBeInTheDocument();
    expect(getSharedProfile).not.toHaveBeenCalled();
  });

  it('offers the normal report to someone who can write candidates', async () => {
    auth.canWriteCandidates = true;
    vi.mocked(getSharedWithMe).mockResolvedValue([]);
    vi.mocked(getSharedReport).mockRejectedValue(notFound);
    renderPage();

    expect(await screen.findByRole('link', { name: 'Open the evaluation report' })).toHaveAttribute(
      'href',
      '/candidates/42/evaluations',
    );
  });

  it('tells a grantee with nothing readable yet to submit their own first', async () => {
    vi.mocked(getSharedReport).mockRejectedValue(notFound); // grant is active, nothing visible
    renderPage();

    expect(await screen.findByText('Nothing to read yet')).toBeInTheDocument();
    expect(screen.queryByText('This share has expired or was revoked')).not.toBeInTheDocument();
    expect(screen.getByLabelText('About this share')).toHaveTextContent('Shared with you by Rita Recruiter');
  });

  it('shows a failure, not an expiry message, when the request breaks', async () => {
    vi.mocked(getSharedReport).mockRejectedValue({ isAxiosError: true, response: { status: 500 } });
    renderPage();

    expect(await screen.findByText('Failed to load the shared evaluations')).toBeInTheDocument();
    expect(screen.queryByText('This share has expired or was revoked')).not.toBeInTheDocument();
  });
});
