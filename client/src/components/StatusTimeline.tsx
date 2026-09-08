import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import { StatusBadge, StatusDot } from './StatusBadge';
import EmptyState from './common/EmptyState';
import { skillColorClass } from '../utils/skillColors';
import { initials } from '../utils/initials';
import type { EvaluationSummary, StatusHistoryEntry } from '../types';

interface Props {
  history: StatusHistoryEntry[];
  /** Admin+ only: show a link from an "Interview Completed" entry to its evaluations. */
  canViewEvaluations?: boolean;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

/** Older "Interview Completed" comments baked the summary in as text; hide that block —
 *  it now renders as structured cards from evaluationSummaries. */
const cleanComment = (comment: string) => comment.split('— Interview evaluations —')[0].trim();

/** Recommendation → status tone class (reuses the shared status-badge palette). */
const recTone = (rec: string | null): string => {
  switch (rec) {
    case 'Recommended': return 'status--success';
    case 'Hold': return 'status--intake';
    case 'Reject': return 'status--reject';
    default: return 'status--muted';
  }
};

const OverallDots = ({ rating }: { rating: number | null }) => (
  <span className="rating-dots" title={rating != null ? `Overall ${rating} of 5` : 'No overall rating'}>
    {[1, 2, 3, 4, 5].map((n) => (
      <span key={n} className={`rating-dot${rating != null && n <= rating ? ' rating-dot--filled' : ''}`} />
    ))}
    <span className="ml-1 text-[length:var(--text-sm)] font-semibold">{rating != null ? `${rating}/5` : '—'}</span>
  </span>
);

/** Rich per-interviewer evaluation summary cards for an "Interview Completed" entry. */
function EvaluationSummaries({ items }: { items: EvaluationSummary[] }) {
  return (
    <div className="eval-summary mt-2">
      <div className="eval-summary__head">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M9 12l2 2 4-5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
        </svg>
        Interview evaluations
        <span className="eval-summary__count">{items.length}</span>
      </div>
      <div className="eval-summary__grid">
        {items.map((e, idx) => (
          <div key={`${e.interviewerName}-${idx}`} className="eval-card">
            <span className="eval-card__avatar">{initials(e.interviewerName) || '?'}</span>
            <div className="eval-card__body">
              <div className="eval-card__top">
                <span className="eval-card__name">{e.interviewerName}</span>
                <span className={`status-badge ${recTone(e.recommendation)}`}>
                  {e.recommendation === 'Other'
                    ? e.recommendationOther?.trim() || 'Other'
                    : e.recommendation ?? 'No recommendation'}
                </span>
              </div>
              <div className="eval-card__meta">
                <OverallDots rating={e.overallRating} />
                {e.submittedAt && (
                  <span className="text-muted-foreground text-[length:var(--text-sm)]">· {formatDay(e.submittedAt)}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StatusTimeline({ history, canViewEvaluations = false }: Props) {
  if (history.length === 0) {
    return (
      <EmptyState
        icon={<History size={20} strokeWidth={1.75} aria-hidden="true" />}
        title="No status history yet"
        description="Every status change is recorded here, with who made it and when."
      />
    );
  }

  return (
    <ul className="timeline">
      {history.map((entry, i) => {
        const isLatest = i === 0;
        const isLast = i === history.length - 1;
        return (
          <li key={entry.id} className="timeline__item">
            {/* node + connector rail */}
            <div className="timeline__rail">
              <StatusDot status={entry.status} />
              {!isLast && <span className="timeline__line" />}
            </div>

            <div className={`timeline__body${isLast ? ' timeline__body--last' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={entry.status} />
                {isLatest && <span className="timeline__current">Current</span>}
              </div>
              <div className="timeline__meta">
                {formatDate(entry.changedAt)} · {entry.changedBy}
              </div>
              {entry.comment && cleanComment(entry.comment) && (
                <div className="mt-1" style={{ whiteSpace: 'pre-line' }}>{cleanComment(entry.comment)}</div>
              )}
              {entry.evaluationSummaries.length > 0 && (
                <EvaluationSummaries items={entry.evaluationSummaries} />
              )}
              {canViewEvaluations &&
                entry.status === 'Interview Completed' &&
                entry.interviewId && (
                  <div className="mt-1 text-[length:var(--text-sm)]">
                    <Link to={`/interviews/${entry.interviewId}`}>View full evaluations →</Link>
                  </div>
                )}
              {entry.taskDetails && (
                <div className="mt-1 text-[length:var(--text-sm)]">
                  <span className="font-semibold">Task:</span> {entry.taskDetails}
                </div>
              )}
              {entry.submissionUrl && (
                <div className="mt-1 text-[length:var(--text-sm)]">
                  <span className="font-semibold">Submission:</span>{' '}
                  <a href={entry.submissionUrl} target="_blank" rel="noreferrer">
                    {entry.submissionUrl}
                  </a>
                </div>
              )}
              {entry.interviewAt && (
                <div className="mt-1 text-[length:var(--text-sm)]">
                  <span className="font-semibold">Interview:</span> {formatDate(entry.interviewAt)}
                </div>
              )}
              {entry.interviewTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {entry.interviewTags.map((tag) => (
                    <span key={tag} className={skillColorClass(tag)}>{tag}</span>
                  ))}
                </div>
              )}
              {entry.interviewers.length > 0 && (
                <div className="mt-2">
                  <div className="text-muted-foreground text-[length:var(--text-sm)] mb-1">Interviewers</div>
                  <div className="flex flex-wrap gap-2">
                    {entry.interviewers.map((iv) => {
                      const pill = (
                        <span className="interviewer-pill">
                          <span className="interviewer-pill__avatar">{initials(iv.name) || '?'}</span>
                          {iv.name}
                        </span>
                      );
                      return entry.interviewId ? (
                        <Link key={iv.userId} to={`/interviews/${entry.interviewId}`} className="no-underline">
                          {pill}
                        </Link>
                      ) : (
                        <span key={iv.userId}>{pill}</span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
