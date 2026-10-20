import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../components/ToastStack';
import InterviewPage from './InterviewPage';
import { getInterview, getInterviewEvaluationRubric, getSharedWithMe } from '../services/api';
import type { InterviewDetail, SharedEvaluationSummary } from '../types';

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ isAdminOrAbove: false }) }));
vi.mock('../services/api', () => ({
  getInterview: vi.fn(),
  getInterviewEvaluationRubric: vi.fn(),
  getSharedWithMe: vi.fn(),
}));
// Heavy children that this test does not exercise.
vi.mock('../components/ReadOnlyCandidateProfile', () => ({ default: () => <div /> }));
vi.mock('../components/EvaluationForm', () => ({
  default: () => <div data-testid="evaluation-form" />,
  EvaluationReadOnly: () => <div />,
}));
vi.mock('../components/RescheduleInterviewModal', () => ({ default: () => null }));
vi.mock('../components/CancelInterviewModal', () => ({ default: () => null }));

const interview = {
  id: 7,
  scheduledAt: '2026-11-10T09:00:00Z',
  candidate: { id: 42, fullName: 'Jane Doe', email: 'jane@test.local', roleApplied: 'QA Engineer' },
  interviewers: [{ userId: 11, name: 'Ivy Interviewer' }],
  canEvaluate: true,
  myEvaluation: null,
  allEvaluations: null,
  notes: null,
  interviewTags: [],
  durationMinutes: 60,
  status: 'Scheduled',
} as unknown as InterviewDetail;

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

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/interviews/7']}>
          <Routes>
            <Route path="/interviews/:id" element={<InterviewPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
};

describe('InterviewPage: earlier rounds shared with the caller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getInterview).mockResolvedValue(interview);
    vi.mocked(getInterviewEvaluationRubric).mockResolvedValue(undefined as never);
    vi.mocked(getSharedWithMe).mockResolvedValue([]);
  });

  it('links to the shared report when this candidate is shared with the caller', async () => {
    vi.mocked(getSharedWithMe).mockResolvedValue([share()]);
    renderPage();

    const link = await screen.findByRole('link', { name: 'Read the shared evaluations' });
    expect(link).toHaveAttribute('href', '/shared/candidates/42/evaluations');
  });

  it('shows no link when nothing is shared', async () => {
    renderPage();

    await screen.findByText('Jane Doe');
    await waitFor(() => expect(getSharedWithMe).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: 'Read the shared evaluations' })).not.toBeInTheDocument();
  });

  it('shows no link for another candidate, or when nothing is readable yet', async () => {
    vi.mocked(getSharedWithMe).mockResolvedValue([
      share({ candidateId: 99 }),
      share({ candidateId: 42, visibleEvaluationCount: 0 }),
    ]);
    renderPage();

    await screen.findByText('Jane Doe');
    await waitFor(() => expect(getSharedWithMe).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: 'Read the shared evaluations' })).not.toBeInTheDocument();
  });
});
