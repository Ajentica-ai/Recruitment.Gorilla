import { CalendarDays, ClipboardList } from 'lucide-react';

import { EvaluationReadOnly } from '@/components/EvaluationForm';
import EmptyState from '@/components/common/EmptyState';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import SectionCard from '@/components/common/SectionCard';
import { EVALUATION_SECTIONS, RECOMMENDATIONS } from '@/utils/evaluationCriteria';
import { skillColorClass } from '@/utils/skillColors';
import { cn } from '@/lib/utils';
import type { CandidateEvaluationReport, ReportEvaluation } from '@/types';

const CRITERION_LABELS: Record<string, string> = Object.fromEntries(
  EVALUATION_SECTIONS.flatMap((s) => s.criteria.map((c) => [c.key, c.label])),
);
/** Keeps per-criterion rows in the same order as the evaluation form. */
const CRITERION_ORDER = EVALUATION_SECTIONS.flatMap((s) => s.criteria.map((c) => c.key));

const recLabel = (value: string) =>
  RECOMMENDATIONS.find((r) => r.value === value)?.label ?? value;

/** Recommendation → a dot-carrying pill, so the outcome isn't colour-alone. */
const recBadgeVariant = (value: string): BadgeVariant =>
  value === 'Recommended'
    ? 'success'
    : value === 'Hold'
      ? 'warning'
      : value === 'Reject'
        ? 'danger'
        : 'neutral';

/** A 1–5 dot meter mirroring the evaluation form's RatingDots. */
function RatingDots({ rating }: { rating: number | null }) {
  return (
    <span className="rating-dots">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={cn('rating-dot', rating != null && n <= rating && 'rating-dot--filled')}
        />
      ))}
      <span className="ml-1 text-[length:var(--text-xs)] text-muted-foreground">
        {rating != null ? rating.toFixed(1) : '—'}
      </span>
    </span>
  );
}

/**
 * The evaluation report's content, with no page chrome of its own.
 *
 * Extracted so the same report can render in two places without a second
 * implementation: the standalone route (which deep links and prints) and the
 * drawer opened from the candidate detail page. A recruiter reading a report
 * is almost always mid-review of that candidate, and sending them to a
 * separate page loses the profile and the status history they were reading it
 * against.
 *
 * `dense` narrows the per-interviewer grid to one column, which is what the
 * drawer's width can hold.
 */
export default function EvaluationReportBody({
  data,
  dense = false,
}: {
  data: CandidateEvaluationReport;
  dense?: boolean;
}) {
  const { summary } = data;

  if (summary.interviewerCount === 0) {
    return (
      <EmptyState
        icon={<ClipboardList size={20} strokeWidth={1.75} aria-hidden="true" />}
        title="No submitted evaluations yet"
        description="Once an interviewer submits and locks their evaluation, it will appear here."
      />
    );
  }

  // Group the flat evaluation list by interview (round), preserving the
  // newest-first order the API returns.
  const groups: {
    interviewId: number;
    scheduledAt: string;
    tags: string[];
    evals: ReportEvaluation[];
  }[] = [];
  for (const r of data.evaluations) {
    let g = groups.find((x) => x.interviewId === r.interviewId);
    if (!g) {
      g = { interviewId: r.interviewId, scheduledAt: r.scheduledAt, tags: r.interviewTags, evals: [] };
      groups.push(g);
    }
    g.evals.push(r);
  }

  return (
    <div className="flex min-w-0 flex-col gap-[var(--stack-gap)]">
      <SectionCard
        title="Summary"
        description={`Across ${summary.interviewerCount} interviewer${summary.interviewerCount === 1 ? '' : 's'}.`}
      >
        <div className={cn('report-summary', dense && 'grid-cols-1')}>
          <div className="flex flex-col gap-3">
            <div>
              <span className="field-label">Average overall rating</span>
              <div className="metric-value">
                {summary.averageOverall != null ? summary.averageOverall.toFixed(1) : '—'}
                <small> / 5</small>
              </div>
            </div>

            <div>
              <span className="field-label">Recommendations</span>
              <div className="flex flex-wrap gap-2">
                {summary.recommendationCounts.length === 0 ? (
                  <span className="table-muted">—</span>
                ) : (
                  summary.recommendationCounts.map((r) => (
                    <Badge key={r.recommendation} variant={recBadgeVariant(r.recommendation)}>
                      {recLabel(r.recommendation)}: {r.count}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </div>

          <div>
            <span className="field-label">Average by criterion</span>
            <table className="table table-sm mb-0 align-middle">
              <tbody>
                {CRITERION_ORDER.map((key) =>
                  summary.criterionAverages.find((c) => c.criterionKey === key),
                )
                  .filter((c): c is NonNullable<typeof c> => c != null)
                  .map((c) => (
                    <tr key={c.criterionKey}>
                      <td>{CRITERION_LABELS[c.criterionKey] ?? c.criterionKey}</td>
                      <td className="col-right w-[128px]">
                        <RatingDots rating={c.average} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      {groups.map((g) => (
        <section key={g.interviewId} className="flex flex-col gap-3">
          <div className="section-head">
            <h3 className="section-title inline-flex items-center gap-2">
              <CalendarDays size={15} strokeWidth={1.75} aria-hidden="true" />
              {new Date(g.scheduledAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </h3>
            {g.tags.length > 0 && (
              <div className="section-head__actions">
                {g.tags.map((t) => (
                  <span key={t} className={skillColorClass(t)}>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={dense ? 'flex flex-col gap-3' : 'grid-2'}>
            {g.evals.map((r) => (
              <SectionCard
                key={r.evaluation.id}
                as="h4"
                title={r.evaluation.interviewerName}
                actions={<Badge variant="success">Submitted</Badge>}
              >
                <EvaluationReadOnly evaluation={r.evaluation} />
              </SectionCard>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
