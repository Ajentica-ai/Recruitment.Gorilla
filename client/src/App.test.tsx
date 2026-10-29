import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Outlet } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './theme/ThemeContext';
import type { Role } from './types';

// Renders the real App, including its own BrowserRouter and the real <Routes> tree, so the test
// exercises the actual route config in App.tsx rather than a hand-built copy of it (#237). No network:
// the provider restores the session through refreshSession(), as ProtectedLayout.test.tsx does.
vi.mock('./services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./services/api')>()),
  refreshSession: vi.fn(),
}));
import { refreshSession } from './services/api';

// The real shell pulls in the sidebar's own queries and the notification hub; only its Outlet matters
// here, the same stand-in ProtectedLayout.test.tsx uses for the same reason.
vi.mock('./components/shell/AppShell', () => ({
  default: function AppShell() {
    return <Outlet />;
  },
}));

const session = (roles: Role[] = ['Recruiter']) => ({
  token: 't', userId: 1, name: 'Test', email: 'test@x.io', roles, mustChangePassword: false, expiresAt: '',
});

const goTo = (path: string) => window.history.pushState({}, '', path);

// LoginPage renders ThemeMenu (useTheme()) unconditionally, so the signed-out case below needs a
// real provider even though the signed-in NotFoundPage case does not.
const renderApp = () => render(<ThemeProvider><App /></ThemeProvider>);

describe('App: an unknown route (#237)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => goTo('/'));

  it('shows a not-found page with a link back to the dashboard, for a signed-in user', async () => {
    vi.mocked(refreshSession).mockResolvedValue(session());
    goTo('/no-such-page');

    renderApp();

    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toHaveAttribute('href', '/');
  });

  it('still sends a signed-out visitor to the login page first', async () => {
    vi.mocked(refreshSession).mockResolvedValue(null);
    goTo('/no-such-page');

    renderApp();

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument();
  });
});
