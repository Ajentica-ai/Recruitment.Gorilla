import { Briefcase } from 'lucide-react';

import EmptyState from './EmptyState';
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
export default function NoJobOpeningNotice({
  action,
  compact = false,
}: {
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

  const title = isAdminOrAbove
    ? 'There are no open job openings'
    : 'You are not assigned to a job opening';

  const description = isAdminOrAbove
    ? 'A CV is filed against a job opening, so create or reopen one before uploading.'
    : 'A CV is filed against a job opening, so you cannot upload until an admin assigns you to one.';

  if (compact) {
    return (
      // Announced, because it explains why the control beside it cannot be used.
      <p role="status" className="mt-1 text-[length:var(--text-sm)] leading-[var(--leading-normal)] text-[var(--danger-text)]">
        <span className="font-semibold">{title}.</span> {description}
      </p>
    );
  }

  return (
    <EmptyState
      icon={<Briefcase className="size-5" strokeWidth={1.75} aria-hidden="true" />}
      title={title}
      description={description}
      action={action}
    />
  );
}
