import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
