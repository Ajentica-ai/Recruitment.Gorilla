import type { ReactNode } from 'react';
import { StatusBadge } from '../StatusBadge';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import type { EvaluationState, MyInterview, UpcomingInterview } from '../../types';

// Status is never colour alone: each badge carries its label.
const stateBadge: Record<EvaluationState, { variant: BadgeVariant; label: string }> = {
  None: { variant: 'neutral', label: 'Pending' },
  Draft: { variant: 'warning', label: 'Draft' },
  Submitted: { variant: 'success', label: 'Submitted' },
};

const DAY_MS = 24 * 3600 * 1000;

export interface UpNextRow {
  key: string;
  href: string;
  name: string;
  role: string | null;
  at: string;
  /** Big figure on the left: the time, or the date for a past interview. */
  clock: string;
  /** Small line under it: "in 1h 20m", a weekday, or the time it happened. */
  when: string;
  soon: boolean;
  badge: ReactNode;
}

export interface UpNextGroup {
  label: string;
  warn?: boolean;
  rows: UpNextRow[];
}

const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const shortDate = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

const dayLabel = (d: Date, now: Date): string => {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start) / DAY_MS);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

const inLabel = (ms: number): string => {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `in ${h}h` : `in ${h}h ${m}m`;
};

/**
 * Interviews that have happened and still owe your evaluation, most recent
 * first. Shared with the hero's "N evaluations to complete" chip so the two
 * counts can't disagree.
 */
export const awaitingEvaluation = (interviews: MyInterview[], now = Date.now()): MyInterview[] =>
  interviews
    .filter((i) => new Date(i.scheduledAt).getTime() < now && i.evaluationState !== 'Submitted')
    .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt));

/** Future rows grouped by calendar day, earliest first. */
function byDay(rows: UpNextRow[], now: Date): UpNextGroup[] {
  const groups: UpNextGroup[] = [];
  for (const row of [...rows].sort((a, b) => +new Date(a.at) - +new Date(b.at))) {
    const label = dayLabel(new Date(row.at), now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(row);
    else groups.push({ label, rows: [row] });
  }
  return groups;
}

function futureRow(base: Omit<UpNextRow, 'clock' | 'when' | 'soon'>, now: Date): UpNextRow {
  const at = new Date(base.at);
  const until = at.getTime() - now.getTime();
  const sameDay = dayLabel(at, now) === 'Today';
  return {
    ...base,
    clock: time(at),
    when: sameDay ? inLabel(until) : at.toLocaleDateString(undefined, { weekday: 'long' }),
    soon: sameDay && until >= 0,
  };
}

/**
 * "Mine": past interviews still owing an evaluation first (they are the
 * overdue work), then upcoming ones by day. Past interviews already submitted
 * are done and drop out.
 */
export function mineGroups(interviews: MyInterview[], now = new Date()): UpNextGroup[] {
  const toRow = (i: MyInterview) => ({
    key: `m-${i.id}`,
    href: `/interviews/${i.id}`,
    name: i.candidateName,
    role: i.role,
    at: i.scheduledAt,
    badge: <Badge variant={stateBadge[i.evaluationState].variant}>{stateBadge[i.evaluationState].label}</Badge>,
  });

  const past = awaitingEvaluation(interviews, now.getTime()).map((i): UpNextRow => {
    const at = new Date(i.scheduledAt);
    return { ...toRow(i), clock: shortDate(at), when: time(at), soon: false };
  });

  const upcoming = interviews
    .filter((i) => new Date(i.scheduledAt).getTime() >= now.getTime())
    .map((i) => futureRow(toRow(i), now));

  return [
    ...(past.length ? [{ label: 'Awaiting evaluation', warn: true, rows: past }] : []),
    ...byDay(upcoming, now),
  ];
}

/** "Team": the scoped upcoming interviews, by day. */
export function teamGroups(interviews: UpcomingInterview[], now = new Date()): UpNextGroup[] {
  return byDay(
    interviews.map((i, idx) =>
      futureRow(
        {
          key: `t-${i.candidateId}-${idx}`,
          href: `/candidates/${i.candidateId}`,
          name: i.fullName,
          role: i.role,
          at: i.interviewAt,
          badge: <StatusBadge status={i.currentStatus} />,
        },
        now,
      ),
    ),
    now,
  );
}
