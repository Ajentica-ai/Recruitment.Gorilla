import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AuthContext } from '../../auth/AuthContext';
import NoJobOpeningNotice from './NoJobOpeningNotice';

/** Minimal auth state: only the role flag this component reads is meaningful here. */
const withAuth = (isAdminOrAbove: boolean, ui: React.ReactElement) => (
  <AuthContext.Provider value={{ isAdminOrAbove } as never}>{ui}</AuthContext.Provider>
);

describe('NoJobOpeningNotice', () => {
  it('tells a recruiter they need an assignment', () => {
    render(withAuth(false, <NoJobOpeningNotice />));

    expect(screen.getByText(/You are not assigned to a job opening/i)).toBeInTheDocument();
    expect(screen.getByText(/until an admin assigns you to one/i)).toBeInTheDocument();
  });

  it('tells an admin to create an opening, never to ask an admin', () => {
    // The rule is that an admin can always upload, so the recruiter sentence would state its
    // opposite. An empty list means something different for them.
    render(withAuth(true, <NoJobOpeningNotice />));

    expect(screen.getByText(/There are no open job openings/i)).toBeInTheDocument();
    expect(screen.getByText(/create or reopen one/i)).toBeInTheDocument();
    expect(screen.queryByText(/assigns you to one/i)).not.toBeInTheDocument();
  });

  it('renders without a provider, falling back to the narrower wording', () => {
    // It is a leaf that only picks wording by role; it must not throw when mounted in isolation,
    // and the fallback must never promise more access than the reader has.
    render(<NoJobOpeningNotice />);

    expect(screen.getByText(/You are not assigned to a job opening/i)).toBeInTheDocument();
  });

  it('has a compact form for sitting beside a field', () => {
    render(withAuth(false, <NoJobOpeningNotice compact />));

    // Announced, because it explains why the neighbouring control cannot be used.
    expect(screen.getByRole('status')).toHaveTextContent(/not assigned to a job opening/i);
  });

  it('distinguishes an expired assignment from no assignment', () => {
    // GetAssignedRolesAsync filters on IsActive only, so a recruiter assigned solely to an
    // opening past its end date still has one. The remedy is extending the date.
    render(withAuth(false, <NoJobOpeningNotice reason="expired" />));

    expect(screen.getByText(/Your job openings have ended/i)).toBeInTheDocument();
    expect(screen.getByText(/extend the end date/i)).toBeInTheDocument();
    expect(screen.queryByText(/not assigned to a job opening/i)).not.toBeInTheDocument();
  });

  it('reports a failed load as a failure, not as having none', () => {
    render(withAuth(false, <NoJobOpeningNotice failed />));

    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
    expect(screen.queryByText(/not assigned to a job opening/i)).not.toBeInTheDocument();
  });

  it('offers a retry when the load failed', async () => {
    const onRetry = vi.fn();
    render(withAuth(false, <NoJobOpeningNotice failed onRetry={onRetry} />));

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('keeps the admin wording whatever the reason', () => {
    // An admin is never blocked by assignment, so the expired case reads the same for them.
    render(withAuth(true, <NoJobOpeningNotice reason="expired" />));

    expect(screen.getByText(/There are no open job openings/i)).toBeInTheDocument();
  });
});
