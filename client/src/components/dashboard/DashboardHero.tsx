import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarClock, CheckCircle2, ClipboardCheck, RefreshCw, UploadCloud, Users } from 'lucide-react';
import { getMyInterviews, getNotifications } from '../../services/api';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '@/components/ui/button';
import { awaitingEvaluation } from './upNextGroups';

const greeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const today = () =>
  new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

/** "Updated just now" / "Updated 4m ago" / "Updated 2h ago". */
const updatedLabel = (at: number, now: number): string => {
  if (!at) return 'Refresh';
  const mins = Math.floor((now - at) / 60000);
  if (mins < 1) return 'Updated just now';
  if (mins < 60) return `Updated ${mins}m ago`;
  return `Updated ${Math.floor(mins / 60)}h ago`;
};

/** A pending-task chip; links somewhere when `to` is set. */
function TaskChip({
  to,
  children,
  tone = 'default',
}: {
  to?: string;
  children: React.ReactNode;
  tone?: 'default' | 'accent';
}) {
  const cls = `hero-chip${tone === 'accent' ? ' hero-chip--accent' : ''}`;
  return to ? (
    <Link to={to} className={cls}>
      {children}
    </Link>
  ) : (
    <span className={cls}>{children}</span>
  );
}

/**
 * The dashboard's opening line: date, how fresh the figures are (and a way to
 * refresh them), the greeting, what you owe today as chips, and the intake
 * shortcuts. On a phone the chips are one sideways row and the shortcuts give
 * way to the floating Upload CVs button.
 */
export default function DashboardHero({
  updatedAt,
  refreshing,
  onRefresh,
}: {
  /** Epoch ms of the most recent dashboard fetch (0 while nothing has loaded). */
  updatedAt: number;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { user, canWriteCandidates } = useAuth();

  const { data: interviews } = useQuery({ queryKey: ['my-interviews'], queryFn: getMyInterviews });
  const { data: notifications } = useQuery({ queryKey: ['notifications'], queryFn: getNotifications });

  // Re-render every half minute so "Updated 2m ago" doesn't freeze.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const pending = awaitingEvaluation(interviews ?? [], now);
  const next = (interviews ?? [])
    .filter((i) => new Date(i.scheduledAt).getTime() >= now)
    .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))[0];
  const unread = notifications?.unreadCount ?? 0;

  const nextLabel = next
    ? isToday(next.scheduledAt)
      ? clock(next.scheduledAt)
      : new Date(next.scheduledAt).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  const nothingPending = pending.length === 0 && unread === 0 && !next;

  const lede = (() => {
    const parts: string[] = [];
    if (pending.length > 0) {
      parts.push(`${pending.length} evaluation${pending.length > 1 ? 's are' : ' is'} waiting`);
    }
    if (next && isToday(next.scheduledAt)) parts.push(`your next interview starts at ${clock(next.scheduledAt)}`);
    if (parts.length === 0) return nothingPending ? "You're all caught up." : 'Here is your recruitment overview for today.';
    const sentence = parts.join(', and ');
    return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
  })();

  return (
    <section className="dashboard-hero-kicker animate-fade-in-up" aria-labelledby="dash-greeting">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="dashboard-hero-kicker__eyebrow flex flex-wrap items-center gap-x-2">
            <span>{today()}</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              className="dash-refresh"
              onClick={onRefresh}
              aria-busy={refreshing}
              aria-label="Refresh dashboard figures"
            >
              <RefreshCw size={13} strokeWidth={2} aria-hidden="true" />
              <span>{refreshing ? 'Refreshing…' : updatedLabel(updatedAt, now)}</span>
            </button>
          </div>
          <h2 className="dashboard-hero-kicker__greeting" id="dash-greeting">
            {greeting()}, {user?.name ?? 'there'}
          </h2>
          <p className="dashboard-hero-kicker__lede mb-0">{lede}</p>
        </div>

        {canWriteCandidates && (
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <Button asChild size="sm" variant="outline" className="gap-1.5 shadow-xs">
              <Link to="/candidates">
                <Users size={14} />
                <span>Candidates</span>
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5 shadow-xs">
              <Link to="/upload">
                <UploadCloud size={14} />
                <span>Upload CVs</span>
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className="hero-chip-row hero-chip-row--scroll mt-3" tabIndex={0} role="group" aria-label="What needs you">
        {pending.length > 0 && (
          <TaskChip to={`/interviews/${pending[0].id}`} tone="accent">
            <ClipboardCheck size={14} strokeWidth={1.75} aria-hidden="true" />
            {pending.length} evaluation{pending.length > 1 ? 's' : ''} to complete
          </TaskChip>
        )}
        {next && (
          <TaskChip to={`/interviews/${next.id}`}>
            <CalendarClock size={14} strokeWidth={1.75} aria-hidden="true" />
            Next interview {nextLabel} · {next.candidateName}
          </TaskChip>
        )}
        {unread > 0 && (
          <TaskChip>
            <Bell size={14} strokeWidth={1.75} aria-hidden="true" />
            {unread} unread notification{unread > 1 ? 's' : ''}
          </TaskChip>
        )}
        {nothingPending && (
          <span className="hero-chip hero-chip--quiet">
            <CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true" />
            You're all caught up.
          </span>
        )}
      </div>
    </section>
  );
}
