import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import KanbanCard from './KanbanCard';
import type { CandidateListItem } from '../../types';

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
