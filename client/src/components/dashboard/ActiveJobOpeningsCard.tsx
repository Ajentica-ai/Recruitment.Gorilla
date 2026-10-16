import { Link } from 'react-router-dom';
import { ArrowUpRight, Briefcase, Calendar, MapPin } from 'lucide-react';
import EmptyState from '../common/EmptyState';
import SectionCard from '../common/SectionCard';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../auth/AuthContext';
import { sortByClosing } from './jobOrder';
import type { JobOpening } from '../../types';

const VISIBLE = 6;
const WEEK_MS = 7 * 24 * 3600 * 1000;

const jobId = (id: number) => `JOB-${String(id).padStart(3, '0')}`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** True when the opening closes within the next 7 days. */
const isClosingSoon = (iso: string): boolean => {
  const diff = new Date(iso).getTime() - Date.now();
  return diff >= 0 && diff < WEEK_MS;
};

const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 3600 * 1000)));

const priorityClass = (p: string) => {
  const key = p.toLowerCase();
  return key === 'high' || key === 'medium' || key === 'low' ? `priority--${key}` : 'priority--low';
};
const priorityLabel = (p: string) => (p.toLowerCase() === 'high' ? 'High priority' : p);

/**
 * Open roles as cards: a sideways snap strip on a phone, a 2- then 3-column
 * grid above that. Replaces the seven-column table, whose Location and
 * Department columns were an empty dash for almost every role. Those details now render
 * only when set.
 */
export default function ActiveJobOpeningsCard({ data }: { data: JobOpening[] }) {
  // /jobs and the candidate list are limited to candidate-managing roles.
  const { canWriteCandidates } = useAuth();
  const jobs = sortByClosing(data).slice(0, VISIBLE);
  const busiest = Math.max(1, ...data.map((j) => j.applicants));

  return (
    <SectionCard
      title="Open roles"
      description={
        data.length > VISIBLE
          ? `${data.length} open, soonest to close first. Showing ${VISIBLE}.`
          : `${data.length} open, soonest to close first.`
      }
      actions={
        canWriteCandidates ? (
          <Button asChild variant="outline" size="sm">
            <Link to="/jobs">
              View all
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </Button>
        ) : undefined
      }
    >
      {data.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={20} strokeWidth={1.75} aria-hidden="true" />}
          title="No active job openings"
          description="Openings you add in Configuration show up here until their end date passes."
          action={
            canWriteCandidates ? (
              <Button asChild>
                <Link to="/configuration">Add a job opening</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="job-rail snap-strip m-0 list-none" tabIndex={0} aria-label="Open roles">
          {jobs.map((job) => {
            const soon = isClosingSoon(job.endDate);
            const body = (
              <>
                <div className="job-tile__top">
                  <span className="job-tile__id">{jobId(job.id)}</span>
                  {job.priority && (
                    <span className={`priority-badge ${priorityClass(job.priority)}`}>{priorityLabel(job.priority)}</span>
                  )}
                </div>
                <p className="job-tile__title">{job.title}</p>
                <div className="job-tile__meta">
                  {job.location && (
                    <span>
                      <MapPin size={13} strokeWidth={1.75} aria-hidden="true" />
                      {job.location}
                    </span>
                  )}
                  {job.department && <span>{job.department}</span>}
                  <span>
                    <Calendar size={13} strokeWidth={1.75} aria-hidden="true" />
                    Closes {formatDate(job.endDate)}
                  </span>
                  {soon && <span className="job-closing-soon">{daysLeft(job.endDate)}d left</span>}
                </div>
                <div className="job-tile__apps">
                  <span>
                    {job.applicants.toLocaleString()} applicant{job.applicants === 1 ? '' : 's'}
                  </span>
                  <span className="job-tile__bar" aria-hidden="true">
                    <span className="job-tile__fill" style={{ width: `${Math.round((job.applicants / busiest) * 100)}%` }} />
                  </span>
                </div>
              </>
            );
            return (
              <li key={job.id} className="flex min-w-0">
                {canWriteCandidates ? (
                  <Link to={`/candidates?role=${job.id}`} className="job-tile w-full" aria-label={`${job.title}, ${job.applicants} applicants. View them.`}>
                    {body}
                  </Link>
                ) : (
                  <div className="job-tile w-full">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
