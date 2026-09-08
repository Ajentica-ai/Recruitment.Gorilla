import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, ChevronDown, ChevronUp, ArrowUpRight } from 'lucide-react';
import { getMyInterviews } from '../../services/api';
import EmptyState from '../common/EmptyState';
import SectionCard from '../common/SectionCard';
import { SkeletonRows } from '../common/Loading';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EvaluationState } from '../../types';

// Prism's glyph-carrying pill badges — status is never colour-alone.
const stateBadge: Record<EvaluationState, { variant: BadgeVariant; label: string }> = {
  None: { variant: 'neutral', label: 'Pending' },
  Draft: { variant: 'warning', label: 'Draft' },
  Submitted: { variant: 'success', label: 'Submitted' },
};

const isSoon = (iso: string) => {
  const diff = new Date(iso).getTime() - Date.now();
  return diff > 0 && diff < 24 * 3600 * 1000;
};

/** Interviews the signed-in user is assigned to, with their evaluation state. */
export default function MyInterviewsCard() {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ['my-interviews'],
    queryFn: getMyInterviews,
  });

  const pending = data.filter((i) => i.evaluationState !== 'Submitted').length;
  const firstPending = data.find((i) => i.evaluationState !== 'Submitted');
  const hasMore = data.length > 2;
  const visibleInterviews = isExpanded ? data : data.slice(0, 2);

  return (
    <SectionCard
      title="My interviews"
      description="Interviews you're assigned to, and where your evaluation stands."
      actions={
        <div className="flex items-center gap-2">
          {pending > 0 && (
            firstPending ? (
              <Badge variant="warning" asChild className="hover:opacity-90 transition-opacity">
                <Link to={`/interviews/${firstPending.id}`} title="Open next pending interview">
                  {pending} awaiting evaluation
                </Link>
              </Badge>
            ) : (
              <Badge variant="warning">{pending} awaiting evaluation</Badge>
            )
          )}
          {hasMore && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="h-7 px-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              {isExpanded ? 'Collapse' : `View all (${data.length})`}
            </Button>
          )}
        </div>
      }
    >
      {isLoading ? (
        <SkeletonRows rows={2} label="Loading your interviews" />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck size={20} strokeWidth={1.75} aria-hidden="true" />}
          title="No assigned interviews"
          description="Interviews you're scheduled for will appear here."
        />
      ) : (
        <div className="space-y-1">
          <ul
            className={cn(
              'divide-y divide-[var(--border-subtle)]',
              isExpanded && data.length > 4 && 'max-h-[380px] overflow-y-auto pr-1'
            )}
          >
            {visibleInterviews.map((i) => {
              const badge = stateBadge[i.evaluationState];
              return (
                <li key={i.id}>
                  <Link
                    to={`/interviews/${i.id}`}
                    className="group flex items-center justify-between gap-4 py-3 px-3 -mx-3 rounded-lg transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] cursor-pointer text-inherit no-underline"
                    title={`Open interview evaluation for ${i.candidateName}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--primary)] transition-colors flex items-center gap-2">
                        <span className="truncate">{i.candidateName}</span>
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">{i.role ?? '—'}</div>
                    </div>

                    <div className="flex items-center gap-3.5 shrink-0">
                      <div className="text-right">
                        <div
                          className={cn(
                            'text-xs text-[var(--text-muted)]',
                            isSoon(i.scheduledAt) && 'text-[var(--danger)] font-semibold'
                          )}
                        >
                          {new Date(i.scheduledAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZoneName: 'short',
                          })}
                        </div>
                        <div className="mt-1 flex justify-end">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </div>
                      </div>

                      <div className="flex items-center justify-center size-7 rounded-md bg-[var(--surface)] text-[var(--text-muted)] group-hover:bg-[var(--primary-subtle)] group-hover:text-[var(--primary)] transition-all">
                        <ArrowUpRight size={15} aria-hidden="true" />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {hasMore && (
            <div className="flex items-center justify-between pt-3 mt-1 border-t border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-muted)]">
                Showing {visibleInterviews.length} of {data.length} interviews
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded((prev) => !prev)}
                className="h-8 px-2.5 text-xs font-medium gap-1 text-[var(--primary)] hover:text-[var(--primary)] hover:bg-[var(--primary-subtle)]"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp size={14} aria-hidden="true" />
                    <span>Show less</span>
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} aria-hidden="true" />
                    <span>Show {data.length - 2} more interviews</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}
