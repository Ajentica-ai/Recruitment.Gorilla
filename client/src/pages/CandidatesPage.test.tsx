import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/ToastStack';
import { renderWithProviders } from '../test/renderWithProviders';
import CandidatesPage from './CandidatesPage';
import type { CandidateListItem } from '../types';

vi.mock('../services/api', () => ({
  getCandidates: vi.fn(),
  getStatusOptions: vi.fn().mockResolvedValue([]),
  getCandidateFilterRoleOptions: vi.fn().mockResolvedValue([]),
  getActiveSkillOptions: vi.fn().mockResolvedValue([]),
  getCandidateBatches: vi.fn().mockResolvedValue([]),
  deleteCandidate: vi.fn(),
}));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ canWriteCandidates: true, isAdminOrAbove: true }),
}));
import { getCandidates } from '../services/api';

const candidate: CandidateListItem = {
  id: 1, fullName: 'Ada Lovelace', email: 'ada@test.com', phone: null, currentTitle: 'Engineer',
  appliedRole: 'Backend Engineer', currentStatus: 'Uploaded', createdAt: '2026-09-10T00:00:00Z', source: null,
};

describe('CandidatesPage table', () => {
  beforeEach(() => {
    vi.mocked(getCandidates).mockResolvedValue({
      items: [candidate], totalCount: 1, page: 1, pageSize: 10, totalPages: 1,
    } as Awaited<ReturnType<typeof getCandidates>>);
  });

  it('left-aligns every data column header so it lines up with its cells', async () => {
    renderWithProviders(<CandidatesPage />);
    await screen.findByText('Ada Lovelace');

    for (const name of [/Name/, /^Email$/, /Current title/, /Status/, /Added/]) {
      const header = screen.getAllByRole('columnheader').find((h) => name.test(h.textContent ?? ''));
      expect(header, `header ${name}`).toHaveClass('text-left');
    }
  });
});

describe('CandidatesPage URL filters (#195)', () => {
  const renderAt = (url: string) =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ToastProvider>
          <MemoryRouter initialEntries={[url]}>
            <CandidatesPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    vi.mocked(getCandidates).mockResolvedValue({
      items: [candidate], totalCount: 1, page: 1, pageSize: 10, totalPages: 1,
    } as Awaited<ReturnType<typeof getCandidates>>);
  });

  it.each([
    ['hired', 'Hired'],
    ['offers', 'In offer stages'],
  ])('shows the %s bucket as a removable chip and sends it to the API', async (bucket, label) => {
    renderAt(`/candidates?bucket=${bucket}`);

    expect(await screen.findByRole('button', { name: `Remove the ${label} filter` })).toBeInTheDocument();
    expect(getCandidates).toHaveBeenCalledWith(expect.objectContaining({ bucket }));
  });

  it('sends the batch filter to the API', async () => {
    renderAt('/candidates?batch=Spring%20intake');

    await screen.findByText('Ada Lovelace');
    expect(getCandidates).toHaveBeenCalledWith(expect.objectContaining({ batch: 'Spring intake' }));
  });
});
