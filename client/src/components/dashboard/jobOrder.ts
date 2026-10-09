import type { JobOpening } from '../../types';

/** Soonest to close first, then by title, so "soonest to close first" is true. */
export const sortByClosing = (jobs: JobOpening[]): JobOpening[] =>
  [...jobs].sort((a, b) => +new Date(a.endDate) - +new Date(b.endDate) || a.title.localeCompare(b.title));
