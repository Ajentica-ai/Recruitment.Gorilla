import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../components/ToastStack';
import CandidateDetailPage from './CandidateDetailPage';

vi.mock('../services/api', () => ({
  getCandidate: vi.fn(),
  getActiveRoleOptions: vi.fn().mockResolvedValue([]),
  getActiveSkillOptions: vi.fn().mockResolvedValue([]),
  getActiveSourceOptions: vi.fn().mockResolvedValue([]),
  deleteCandidate: vi.fn(),
  previewCvFile: vi.fn(),
  updateCandidate: vi.fn(),
}));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, name: 'Admin', email: 'admin@test.com' }, canWriteCandidates: true, isAdminOrAbove: true }),
}));

import { getCandidate } from '../services/api';

afterEach(() => vi.clearAllMocks());

/**
 * Uses a QueryClient with global retry:3 so the test proves the per-query retry
 * override (not retry:false) is what prevents the 404 from being retried.
 */
function renderCandidate(id: number) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: 3 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/candidates/${id}`]}>
          <Routes>
            <Route path="/candidates/:id" element={<CandidateDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('CandidateDetailPage — 404 handling', () => {
  it('shows the error state immediately without retrying on 404', async () => {
    vi.mocked(getCandidate).mockRejectedValue({
      isAxiosError: true,
      response: { status: 404 },
    });

    renderCandidate(999);

    // 2 s is well above the render time but far below the ~8-10 s backoff from 3 retries.
    await screen.findByText("Couldn't load this candidate", {}, { timeout: 2000 });
    expect(getCandidate).toHaveBeenCalledTimes(1);
  });
});
