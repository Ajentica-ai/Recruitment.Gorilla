import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Role } from '../types';
import RequireRole from './RequireRole';

let roles: Role[] = [];
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ hasAnyRole: (...want: Role[]) => want.some((r) => roles.includes(r)) }),
}));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>Dashboard</p>} />
        <Route
          path="/candidates"
          element={
            <RequireRole roles={['SuperAdmin', 'Admin', 'Recruiter']}>
              <p>Candidates list</p>
            </RequireRole>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

describe('RequireRole', () => {
  it('sends a user without the role to the Dashboard, which every role can open', () => {
    roles = ['Interviewer'];
    renderAt('/candidates');
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Candidates list')).not.toBeInTheDocument();
  });

  it('renders the page for a user with one of the roles', () => {
    roles = ['Recruiter'];
    renderAt('/candidates');
    expect(screen.getByText('Candidates list')).toBeInTheDocument();
  });
});
