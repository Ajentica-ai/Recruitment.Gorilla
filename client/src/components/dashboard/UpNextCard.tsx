import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, ChevronRight } from 'lucide-react';
import { getMyInterviews } from '../../services/api';
import SectionCard from '../common/SectionCard';
import Avatar from '../common/Avatar';
import { SkeletonRows } from '../common/Loading';
import { Badge } from '@/components/ui/badge';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';
import { awaitingEvaluation, mineGroups, teamGroups, type UpNextRow } from './upNextGroups';
import type { UpcomingInterview } from '../../types';

const VISIBLE = 5;

function Row({ row }: { row: UpNextRow }) {
  return (
    <li>
      <Link to={row.href} className="upnext-row" aria-label={`${row.name}, ${row.role ?? 'no role'}, ${row.clock} ${row.when}`}>
        <span className="upnext-row__time">
          <span className="upnext-row__clock">{row.clock}</span>
          <span className={cn('upnext-row__when', row.soon && 'upnext-row__when--soon')}>{row.when}</span>
        </span>
        <Avatar name={row.name} />
        <span className="upnext-row__main">
          <span className="upnext-row__name">{row.name}</span>
          <span className="upnext-row__meta">
            <span>{row.role ?? 'No role'}</span>
            {row.badge}
          </span>
        </span>
        <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" className="row-chevron" />
      </Link>
    </li>
  );
}

/**
 * The first card on the dashboard: the interviews that need you. Replaces the
 * separate "My interviews" and "Upcoming interviews" cards, which were two
 * full-height empty states whenever nothing was booked.
 *
 * `team` is the owner-scoped upcoming list; pass it only to roles that manage
 * candidates. Without it there is no Mine/Team toggle.
 */
export default function UpNextCard({ team }: { team?: UpcomingInterview[] }) {
  const [view, setView] = useState<'mine' | 'team'>('mine');
  const [expanded, setExpanded] = useState(false);

  const { data: mine = [], isLoading } = useQuery({ queryKey: ['my-interviews'], queryFn: getMyInterviews });

  const showTeam = team !== undefined && view === 'team';
  const groups = showTeam ? teamGroups(team) : mineGroups(mine);
  const total = groups.reduce((n, g) => n + g.rows.length, 0);

  // Cap the rows, not the groups: keep whole day headings with the rows shown.
  let budget = expanded ? Infinity : VISIBLE;
  const visible = groups
    .map((g) => {
      const rows = g.rows.slice(0, Math.max(0, budget));
      budget -= rows.length;
      return { ...g, rows };
    })
    .filter((g) => g.rows.length > 0);

  const pending = awaitingEvaluation(mine);
  const firstPending = pending[0];

  return (
    <SectionCard
      title="Up next"
      description={showTeam ? 'Interviews across your candidates.' : 'Interviews you are on, and your evaluation state.'}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {!showTeam && firstPending && (
            <Badge variant="warning" asChild>
              <Link to={`/interviews/${firstPending.id}`} title="Open the oldest interview awaiting your evaluation">
                {pending.length} awaiting evaluation
              </Link>
            </Badge>
          )}
          {team !== undefined && (
            <Segmented
              type="single"
              value={view}
              onValueChange={(v) => {
                if (v === 'mine' || v === 'team') {
                  setView(v);
                  setExpanded(false);
                }
              }}
              aria-label="Whose interviews"
            >
              <SegmentedItem value="mine">Mine</SegmentedItem>
              <SegmentedItem value="team">Team</SegmentedItem>
            </Segmented>
          )}
        </div>
      }
    >
      {isLoading && !showTeam ? (
        <SkeletonRows rows={2} label="Loading your interviews" />
      ) : total === 0 ? (
        <div className="slim-empty">
          <CalendarCheck size={18} strokeWidth={1.75} aria-hidden="true" />
          <span>
            <strong>Nothing scheduled.</strong>{' '}
            {showTeam ? 'Upcoming interviews on your candidates will show here.' : "Interviews you're assigned to will show here."}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h4 className={cn('when-label', g.warn && 'when-label--warn')}>{g.label}</h4>
              <ul className="m-0 list-none p-0">
                {g.rows.map((row) => (
                  <Row key={row.key} row={row} />
                ))}
              </ul>
            </section>
          ))}
          {total > VISIBLE && (
            <button type="button" className="dash-more mt-2" onClick={() => setExpanded((e) => !e)}>
              {expanded ? 'Show fewer' : `Show all ${total} interviews`}
            </button>
          )}
        </div>
      )}
    </SectionCard>
  );
}
