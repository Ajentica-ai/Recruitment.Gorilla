import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ActiveJobOpeningsTable from './ActiveJobOpeningsTable';

const auth = vi.hoisted(() => ({ canWriteCandidates: true }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => auth }));

const renderTable = () =>
  render(
    <MemoryRouter>
      <ActiveJobOpeningsTable data={[]} />
    </MemoryRouter>,
  );

describe('ActiveJobOpeningsTable', () => {
  it('links "View all" to the Job Openings page', () => {
    auth.canWriteCandidates = true;
    renderTable();
    expect(screen.getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/jobs');
  });

  it('hides "View all" for roles that cannot open the Job Openings page', () => {
    auth.canWriteCandidates = false;
    renderTable();
    expect(screen.queryByRole('link', { name: 'View all' })).not.toBeInTheDocument();
  });
});
