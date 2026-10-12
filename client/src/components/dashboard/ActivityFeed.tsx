import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, History } from 'lucide-react';
import SectionCard from '../common/SectionCard';
import Avatar from '../common/Avatar';
import { StatusBadge } from '../StatusBadge';
import { Button } from '@/components/ui/button';
import { groupActivity, relativeTime, type ActivityRun } from './activityGroups';
import type { ActivityItem } from '../../types';

const VISIBLE = 5;

function Run({ run }: { run: ActivityRun }) {
  const [open, setOpen] = useState(false);
  const newest = run.events[0];
  const oldest = run.events[run.events.length - 1];
  const many = run.events.length > 1;
  const listId = `activity-${run.key}`;

  return (
    <div className="activity-row">
      <Avatar name={run.fullName} />
      <div className="activity-row__main">
        <Link to={`/candidates/${run.candidateId}`} className="activity-row__name">
          {run.fullName}
        </Link>
        <div className="activity-row__line">
          {many && oldest.status !== newest.status ? (
            <>
              <StatusBadge status={oldest.status} />
              <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" className="text-[var(--muted-light)]" />
              <span className="sr-only">to</span>
              <StatusBadge status={newest.status} />
            </>
          ) : (
            <StatusBadge status={newest.status} />
          )}
        </div>
        <div className="activity-row__meta">
          <span>by {run.changedBy}</span>
          {many && (
            <button
              type="button"
              className="activity-row__toggle"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? 'Hide changes' : `${run.events.length} changes`}
            </button>
          )}
        </div>
        {many && open && (
          <ul className="activity-events" id={listId}>
            {run.events.map((e, i) => (
              <li key={i}>
                <StatusBadge status={e.status} />
                <span>{relativeTime(e.changedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <span className="activity-row__time">{relativeTime(newest.changedAt)}</span>
    </div>
  );
}

/** Latest status changes on your candidates, grouped by day. */
export default function ActivityFeed({ items, viewAllHref }: { items: ActivityItem[]; viewAllHref: string }) {
  const [expanded, setExpanded] = useState(false);
  const days = groupActivity(items);
  const totalRuns = days.reduce((n, d) => n + d.runs.length, 0);

  let budget = expanded ? Infinity : VISIBLE;
  const visible = days
    .map((d) => {
      const runs = d.runs.slice(0, Math.max(0, budget));
      budget -= runs.length;
      return { ...d, runs };
    })
    .filter((d) => d.runs.length > 0);

  return (
    <SectionCard
      title="Recent activity"
      description="Back-to-back changes on one candidate are grouped."
      actions={
        <Button asChild variant="outline" size="sm">
          <Link to={viewAllHref}>
            View all
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      {items.length === 0 ? (
        <div className="slim-empty">
          <History size={18} strokeWidth={1.75} aria-hidden="true" />
          <span>
            <strong>No recent activity.</strong> Status changes on your candidates will show here.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((d) => (
            <section key={d.label} aria-label={d.label}>
              <h4 className="when-label">{d.label}</h4>
              {d.runs.map((run) => (
                <Run key={run.key} run={run} />
              ))}
            </section>
          ))}
          {totalRuns > VISIBLE && (
            <button type="button" className="dash-more" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Show less' : `Show ${totalRuns - VISIBLE} more`}
            </button>
          )}
        </div>
      )}
    </SectionCard>
  );
}
