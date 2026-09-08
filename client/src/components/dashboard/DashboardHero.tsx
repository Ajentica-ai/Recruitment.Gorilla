import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarClock, CheckCircle2, ClipboardCheck, UploadCloud, Users } from 'lucide-react';
import { getMyInterviews, getNotifications } from '../../services/api';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '@/components/ui/button';

const greeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const today = new Date().toLocaleDateString(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

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
 * Dashboard welcome kicker: greeting + user + date, pending task chips,
 * and quick-action shortcuts for candidate intake and review.
 */
export default function DashboardHero() {
  const { user, canWriteCandidates } = useAuth();

  const { data: interviews } = useQuery({ queryKey: ['my-interviews'], queryFn: getMyInterviews });
  const { data: notifications } = useQuery({ queryKey: ['notifications'], queryFn: getNotifications });

  const pending = (interviews ?? []).filter((i) => i.evaluationState !== 'Submitted');
  const upcoming = (interviews ?? [])
    .filter((i) => new Date(i.scheduledAt).getTime() >= Date.now())
    .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  const next = upcoming[0];
  const unread = notifications?.unreadCount ?? 0;

  const nextTime = next
    ? new Date(next.scheduledAt).toLocaleString(undefined, {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : null;

  const nothingPending = pending.length === 0 && unread === 0 && !next;

  return (
    <div className="dashboard-hero-kicker animate-fade-in-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="dashboard-hero-kicker__eyebrow">{today}</div>
          <h2 className="dashboard-hero-kicker__greeting">
            {greeting()}, {user?.name ?? 'there'}
          </h2>
          <p className="dashboard-hero-kicker__lede mb-0">
            {nothingPending
              ? 'All caught up — no urgent tasks require your attention.'
              : "Here is your recruitment overview for today."}
          </p>
        </div>

        {canWriteCandidates && (
          <div className="flex items-center gap-2 shrink-0">
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

      <div className="hero-chip-row mt-3.5">
        {pending.length > 0 && (
          <TaskChip to={`/interviews/${pending[0].id}`} tone="accent">
            <ClipboardCheck size={14} strokeWidth={1.75} aria-hidden="true" />
            {pending.length} evaluation{pending.length > 1 ? 's' : ''} to complete
          </TaskChip>
        )}
        {next && (
          <TaskChip to={`/interviews/${next.id}`}>
            <CalendarClock size={14} strokeWidth={1.75} aria-hidden="true" />
            Next interview: {nextTime}
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
    </div>
  );
}
