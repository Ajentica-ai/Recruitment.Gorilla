import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import KanbanCard from './KanbanCard';
import KanbanBoard from './KanbanBoard';
import { renderWithProviders } from '../../test/renderWithProviders';
import { addStatus, getStatusOptions, getNextStatusOptions } from '../../services/api';
import type { CandidateListItem } from '../../types';

vi.mock('../../services/api', () => ({
  addStatus: vi.fn(),
  getStatusOptions: vi.fn(),
  getNextStatusOptions: vi.fn(),
}));

describe('KanbanCard Component', () => {
  const mockCandidate: CandidateListItem = {
    id: 101,
    fullName: 'Alice Walker',
    email: 'alice@example.com',
    phone: '+1 555 0192',
    currentTitle: 'Senior Fullstack Engineer',
    appliedRole: 'Staff Software Engineer',
    currentStatus: 'Interview Scheduled',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    source: 'LinkedIn',
  };

  it('renders candidate details, role, and source tag', () => {
    const onAdvance = vi.fn();
    render(
      <BrowserRouter>
        <KanbanCard candidate={mockCandidate} onAdvanceClick={onAdvance} canWrite={true} />
      </BrowserRouter>,
    );

    expect(screen.getByText('Alice Walker')).toBeDefined();
    // Role and source share one meta line on the compact card.
    expect(screen.getByText('Staff Software Engineer · LinkedIn')).toBeDefined();
    expect(screen.getByText('AW')).toBeDefined(); // Initials
    expect(screen.getByText(/2d in stage/)).toBeDefined();
  });

  it('displays stagnant warning badge when candidate is in stage >= 5 days', () => {
    const stagnantCandidate: CandidateListItem = {
      ...mockCandidate,
      updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const onAdvance = vi.fn();
    render(
      <BrowserRouter>
        <KanbanCard candidate={stagnantCandidate} onAdvanceClick={onAdvance} canWrite={true} />
      </BrowserRouter>,
    );

    expect(screen.getByText(/7d Stagnant/i)).toBeDefined();
  });

  it('calls onAdvanceClick when Advance button is clicked', () => {
    const onAdvance = vi.fn();
    render(
      <BrowserRouter>
        <KanbanCard candidate={mockCandidate} onAdvanceClick={onAdvance} canWrite={true} />
      </BrowserRouter>,
    );

    const advanceBtn = screen.getByRole('button', { name: /advance/i });
    fireEvent.click(advanceBtn);
    expect(onAdvance).toHaveBeenCalledWith(mockCandidate);
  });
});

describe('KanbanBoard direct drag-and-drop transition', () => {
  const candidates: CandidateListItem[] = [
    {
      id: 42,
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+1 555 0100',
      currentTitle: 'Engineer',
      appliedRole: 'Backend Engineer',
      currentStatus: 'Interview Completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'Referral',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStatusOptions).mockResolvedValue([
      { id: 8, name: 'Interview Completed', sortOrder: 10, isInitial: false },
      { id: 9, name: 'Recommended', sortOrder: 11, isInitial: false },
    ]);
    // "Recommended" is not in STAGES_REQUIRING_MODAL, so a drop there takes the direct-transition
    // path (directTransitionMutation) rather than opening AddStatusModal.
    vi.mocked(getNextStatusOptions).mockResolvedValue([
      { id: 9, name: 'Recommended', sortOrder: 11, isInitial: false },
    ]);
    vi.mocked(addStatus).mockResolvedValue({} as never);
  });

  it('invalidates the dashboard queries after a direct drag-and-drop transition', async () => {
    // Regression test for RG-75: same gap as AddStatusModal, this mutation never invalidated the
    // dashboard's KPI queries, so they went stale after a card was dropped on a new column.
    // renderWithProviders already supplies a Router (MemoryRouter) — KanbanBoard doesn't route
    // itself, but AddStatusModal's sibling components further down the tree expect one present.
    const { container, queryClient } = renderWithProviders(
      <KanbanBoard candidates={candidates} isLoading={false} canWrite />,
    );
    await screen.findByText('Jane Doe');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const targetColumn = container.querySelector('[data-status-name="Recommended"]');
    expect(targetColumn).not.toBeNull();

    fireEvent.drop(targetColumn!, {
      dataTransfer: { getData: () => JSON.stringify({ candidateId: 42, currentStatus: 'Interview Completed' }) },
    });

    await waitFor(() => expect(addStatus).toHaveBeenCalledWith(42, expect.objectContaining({ status: 'Recommended' })));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['candidates'] });
  });
});
