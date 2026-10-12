import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ProtectedLayout } from './App';
import type { Role } from './types';

// No network: the provider restores the session through refreshSession().
// App imports every page, so keep the rest of the module real and stub only the auth calls.
vi.mock('./services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./services/api')>()),
  refreshSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));
import { refreshSession, logout } from './services/api';

// The real shell pulls in queries and the notification hub; only its logout button matters here.
vi.mock('./components/shell/AppShell', () => ({
  default: function AppShell() {
    const { logout } = useAuth();
    return <button onClick={() => void logout()}>Log out</button>;
  },
}));

const session = (roles: Role[]) => ({
  token: 't', name: 'Test', email: 'test@x.io', roles, mustChangePassword: false, expiresAt: '',
});

/** Shows the router state the login page would read its return path from. */
function LoginProbe() {
  const state = useLocation().state as { from?: string } | null;
  return (
    <div>
      <span data-testid="from">{state?.from ?? 'none'}</span>
    </div>
  );
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/candidates" element={<p>Candidates</p>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );

describe('ProtectedLayout return path', () => {
  beforeEach(() => vi.clearAllMocks());

  it('remembers the page when an unauthenticated visitor is sent to the login page', async () => {
    vi.mocked(refreshSession).mockResolvedValue(null);
    renderAt('/candidates');
    await waitFor(() => expect(screen.getByTestId('from').textContent).toBe('/candidates'));
  });

  it('forgets the page after an explicit logout, so the next user does not inherit it', async () => {
    vi.mocked(refreshSession).mockResolvedValue(session(['Recruiter']));
    vi.mocked(logout).mockResolvedValue(undefined);
    renderAt('/candidates');
    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(screen.getByTestId('from').textContent).toBe('none'));
  });
});
