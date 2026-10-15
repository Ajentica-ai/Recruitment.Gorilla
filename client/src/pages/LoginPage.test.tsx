import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/theme/ThemeContext';
import LoginPage from './LoginPage';

const auth = vi.hoisted(() => ({ isAuthenticated: true, login: vi.fn() }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => auth }));

const renderLogin = (state?: { from: string }) =>
  render(
    <ThemeProvider>
    <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>Dashboard</p>} />
        <Route path="/candidates" element={<p>Candidates list</p>} />
        <Route path="/interviews/7" element={<p>Interview 7</p>} />
      </Routes>
    </MemoryRouter>
    </ThemeProvider>,
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

describe('LoginPage sign-in errors', () => {
  const failWith = (status: number, data: unknown) =>
    auth.login.mockRejectedValue(
      new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, { status, data } as AxiosResponse),
    );

  const submit = async () => {
    auth.isAuthenticated = false;
    renderLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Email/), 'ada@test.com');
    await user.type(screen.getByLabelText(/Password/), 'a-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
  };

  it('tells an inactive account to contact the administrator', async () => {
    failWith(403, { code: 'account_inactive', message: 'Your account is inactive. Please contact your administrator.' });
    await submit();
    expect(await screen.findByText('Your account is inactive. Please contact your administrator.')).toBeInTheDocument();
    expect(screen.queryByText('Invalid email or password.')).not.toBeInTheDocument();
  });

  it('keeps the generic message for wrong credentials', async () => {
    failWith(401, { message: 'Invalid email or password.' });
    await submit();
    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
  });

  it('shows the generic failure for anything else', async () => {
    failWith(500, {});
    await submit();
    await waitFor(() => expect(screen.getByText('Unable to sign in. Please try again.')).toBeInTheDocument());
  });
});
