import { Briefcase } from 'lucide-react';

import EmptyState from './EmptyState';
import { Button } from '@/components/ui/button';
import { useOptionalAuth } from '../../auth/AuthContext';

/**
 * Shown wherever a CV has to be filed against a job opening and the caller has none to choose.
 *
 * Without this the affected pages simply dead-ended: the dropzone sat inert behind "Choose a job
 * opening first" above an empty dropdown, naming neither the cause nor the remedy, which is what
 * issue #169 was reported as ("Recruiter user cannot upload CVs").
 *
 * The wording is split by role because the rule is: a Recruiter without an assignment cannot
 * upload a CV, an Admin can. An Admin is never blocked by assignment, so telling them to ask an
 * admin for one would state the opposite of the rule; for them an empty list means no open
 * opening exists at all, which is a different problem with a different fix.
 */

/**
 * Why there is nothing to choose. `GetAssignedRolesAsync` filters on `IsActive` only, so a
 * Recruiter assigned solely to an opening whose end date has passed still *has* an assignment:
 * telling them they have none would be untrue, and would send them to ask for the wrong thing.
 * The remedy there is the one the server already names, extending the End Date.
 */
export type NoJobOpeningReason = 'unassigned' | 'expired';

export default function NoJobOpeningNotice({
  reason = 'unassigned',
  failed = false,
  onRetry,
  action,
  compact = false,
}: {
  reason?: NoJobOpeningReason;
  /** The openings could not be loaded at all, which is not the same as having none. */
  failed?: boolean;
  onRetry?: () => void;
  /** Optional call to action, e.g. a link to Jobs for an Admin who can create one. */
  action?: React.ReactNode;
  /** Inline single line, for sitting beside a form field rather than replacing a panel. */
  compact?: boolean;
}) {
  // Optional on purpose: this is a leaf that only picks its wording by role, and it must still
  // render when mounted outside a provider. Absent auth falls back to the Recruiter sentence,
  // the narrower of the two, so a missing provider can never tell someone they may do more
  // than they can. In the app the provider always wraps these pages.
  const isAdminOrAbove = useOptionalAuth()?.isAdminOrAbove ?? false;

  let title: string;
  let description: string;

  if (failed) {
    // A failed request left exactly the dead end this component exists to remove: an empty
    // dropdown and no explanation. Say that it broke rather than implying there are none.
    title = 'Job openings could not be loaded';
    description = 'Something went wrong fetching them, so there is nothing to choose from yet.';
  } else if (isAdminOrAbove) {
    title = 'There are no open job openings';
    description = 'A CV is filed against a job opening, so create or reopen one before uploading.';
  } else if (reason === 'expired') {
    title = 'Your job openings have ended';
    description =
      'A CV is filed against an open job opening. Ask an admin to extend the end date, or to assign you to another opening.';
  } else {
    title = 'You are not assigned to a job opening';
    description =
      'A CV is filed against a job opening, so you cannot upload until an admin assigns you to one.';
  }

  if (compact) {
    return (
      // Announced, because it explains why the control beside it cannot be used.
      <p role="status" className="mt-1 text-[length:var(--text-sm)] leading-[var(--leading-normal)] text-[var(--danger-text)]">
        <span className="font-semibold">{title}.</span> {description}
        {failed && onRetry && (
          <>
            {' '}
            <button type="button" className="underline" onClick={onRetry}>
              Try again
            </button>
          </>
        )}
      </p>
    );
  }

  return (
    <EmptyState
      variant={failed ? 'error' : 'empty'}
      icon={failed ? undefined : <Briefcase className="size-5" strokeWidth={1.75} aria-hidden="true" />}
      title={title}
      description={description}
      action={
        action ??
        (failed && onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined)
      }
    />
  );
}
