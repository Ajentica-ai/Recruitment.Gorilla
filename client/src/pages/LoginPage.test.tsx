import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from './LoginPage';

vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, login: vi.fn() }) }));

const renderLogin = (state?: { from: string }) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>Dashboard</p>} />
        <Route path="/candidates" element={<p>Candidates list</p>} />
        <Route path="/interviews/7" element={<p>Interview 7</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe('LoginPage', () => {
  it('lands a signed-in user on the Dashboard when no destination was saved', () => {
    renderLogin();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('returns a signed-in user to the page they were sent away from', () => {
    renderLogin({ from: '/interviews/7' });
    expect(screen.getByText('Interview 7')).toBeInTheDocument();
  });
});
