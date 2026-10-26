import { jobStatus, type JobStatusInput } from './jobStatus';

/**
 * The job openings a CV may actually be filed against.
 *
 * A CV is always uploaded, imported or approved against one opening, and only an opening that is
 * still live will be accepted by the server, so every surface that offers the choice has to apply
 * the same filter. It lived twice, copied verbatim, in `BulkUploader` and `JsonImporter`; keeping
 * one copy is what stops the upload and import forms offering different sets.
 *
 * Note what this is *not*: it does not decide who may use an opening. The list it is given is
 * already scoped by the server (`GET /api/candidates/role-options` returns every active opening to
 * an Admin, but only assigned ones to a Recruiter), and that scoping is the authorization rule.
 * This only drops the ones whose deadline has passed or that were deactivated.
 */
export function offerableJobOpenings<T extends JobStatusInput>(openings: T[]): T[] {
  return openings.filter((o) => {
    const status = jobStatus(o);
    return status === 'open' || status === 'closing-soon';
  });
}
