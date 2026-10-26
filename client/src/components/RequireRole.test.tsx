import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Role } from '../types';
import RequireRole from './RequireRole';
import { ToastProvider } from './ToastStack';

let roles: Role[] = [];
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ hasAnyRole: (...want: Role[]) => want.some((r) => roles.includes(r)) }),
}));

const renderAt = (path: string) =>
  render(
    <ToastProvider>
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
    </MemoryRouter>
    </ToastProvider>,
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

  it('tells the user why they were sent to the Dashboard (#198)', async () => {
    roles = ['Interviewer'];
    renderAt('/candidates');

    expect(await screen.findByText("You don't have access to that page.")).toBeInTheDocument();
  });

  it('says nothing to a user who may open the page (#198)', () => {
    roles = ['Recruiter'];
    renderAt('/candidates');

    expect(screen.queryByText("You don't have access to that page.")).not.toBeInTheDocument();
  });
});
