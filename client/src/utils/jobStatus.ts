import type { BadgeVariant } from '@/components/ui/badge';

/**
 * The single lifecycle state of a job opening.
 *
 * `isActive` and `endDate` used to be rendered as two independent facts — a
 * green "Active" badge in one column and red "· Closed" text in another — which
 * meant a row could assert both at once. They are not independent: an opening
 * past its end date is closed no matter what the flag says, and a deactivated
 * one is off the board regardless of the date. Collapsing them here makes that
 * precedence explicit and testable.
 */
export type JobStatus = 'open' | 'closing-soon' | 'closed' | 'inactive';

/** An opening this close to its end date is called out so it isn't missed. */
export const CLOSING_SOON_MS = 7 * 24 * 60 * 60 * 1000;

export interface JobStatusInput {
  isActive: boolean;
  /** ISO string. Absent means no deadline was set. */
  endDate?: string | null;
}

/**
 * Precedence: deactivated beats everything, then the deadline. `now` is
 * injectable so the boundary can be tested without freezing the clock.
 */
export function jobStatus(job: JobStatusInput, now: number = Date.now()): JobStatus {
  if (!job.isActive) return 'inactive';
  if (!job.endDate) return 'open';

  const remaining = new Date(job.endDate).getTime() - now;
  // An unparseable date is not evidence the opening closed — leave it open
  // rather than inventing a deadline.
  if (Number.isNaN(remaining)) return 'open';

  if (remaining < 0) return 'closed';
  if (remaining <= CLOSING_SOON_MS) return 'closing-soon';
  return 'open';
}

/** Badge tone + label for a status. */
export const JOB_STATUS_BADGE: Record<JobStatus, { variant: BadgeVariant; label: string }> = {
  open: { variant: 'success', label: 'Open' },
  'closing-soon': { variant: 'warning', label: 'Closing soon' },
  closed: { variant: 'danger', label: 'Closed' },
  inactive: { variant: 'neutral', label: 'Inactive' },
};

/**
 * Whole days from now until the deadline. Negative once it has passed, null
 * when there is no deadline.
 *
 * Counted in whole days rather than by 24-hour blocks: a deadline at 09:00
 * tomorrow is "1 day left" whether you ask at 08:00 or at 23:00 today, which is
 * how people read a date.
 */
export function daysUntil(endDate?: string | null, now: number = Date.now()): number | null {
  if (!endDate) return null;
  const end = new Date(endDate).getTime();
  if (Number.isNaN(end)) return null;
  const startOfDay = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  return Math.round((startOfDay(end) - startOfDay(now)) / 86_400_000);
}

/**
 * How far through its posting window an opening is, 0–100.
 *
 * Drives the progress bar. Returns null when it can't be computed — no dates,
 * or an end date at or before the posted date — rather than guessing, so the
 * bar is omitted instead of showing a fabricated 0%.
 */
export function elapsedPercent(
  createdAt?: string | null,
  endDate?: string | null,
  now: number = Date.now(),
): number | null {
  if (!createdAt || !endDate) return null;
  const start = new Date(createdAt).getTime();
  const end = new Date(endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  const pct = ((now - start) / (end - start)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}
