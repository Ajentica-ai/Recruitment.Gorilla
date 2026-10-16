import { useRef, useState } from 'react';
import KpiCard from './KpiCard';
import {
  IdCardIcon,
  HourglassIcon,
  PersonCheckIcon,
  PersonXIcon,
  CalendarPlusIcon,
  ShareIcon,
} from './kpiIcons';
import type { DashboardKpis } from '../../types';
import { cn } from '@/lib/utils';

const TILE_COUNT = 6;

/**
 * The six pipeline figures. On a phone they are one sideways strip that snaps
 * a tile at a time (with dots for where you are); from 768px up they are the
 * 3-across grid.
 *
 * Every tile drills through to the list showing exactly what it counts. The
 * multi-status and date-window ones go via `bucket`, which the API resolves
 * with the same definitions the dashboard uses (see CandidateBuckets), so a
 * tile and its list can't disagree. `canDrill` is false for Interviewers, who
 * can see the figures but not the candidate list.
 */
export default function KpiStrip({
  kpis,
  spark,
  canDrill,
}: {
  kpis: DashboardKpis;
  /** Daily new-candidate counts for the last 14 days, oldest first. */
  spark?: number[];
  canDrill: boolean;
}) {
  const [active, setActive] = useState(0);
  const strip = useRef<HTMLDivElement>(null);

  const total = kpis.totalCandidates;
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
  const to = (href: string) => (canDrill ? href : undefined);

  // Which tile is at the strip's leading edge, for the dots. A no-op once the
  // strip is a grid, because it no longer scrolls.
  const onScroll = () => {
    const el = strip.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    const step = first.offsetWidth + parseFloat(getComputedStyle(el).columnGap || '0');
    if (step > 0) setActive(Math.min(TILE_COUNT - 1, Math.round(el.scrollLeft / step)));
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div
        ref={strip}
        className="kpi-strip snap-strip"
        tabIndex={0}
        role="group"
        aria-label="Pipeline figures"
        onScroll={onScroll}
      >
        {/* Only the two figures that carry a judgement are coloured. "Total"
            and "New this week" are neither good nor bad. */}
        <KpiCard
          icon={<IdCardIcon />}
          label="Total"
          value={total}
          delta={{ value: kpis.newThisWeek, label: 'this week' }}
          to={to('/candidates')}
        />
        <KpiCard
          icon={<HourglassIcon />}
          label="In process"
          value={kpis.inProcess}
          sub={`${pct(kpis.inProcess)}% of total`}
          percent={pct(kpis.inProcess)}
          to={to('/candidates?bucket=in-process')}
        />
        <KpiCard
          tone="green"
          icon={<PersonCheckIcon />}
          label="Recommended"
          value={kpis.recommended}
          delta={{ value: kpis.recommendedThisWeek, label: 'this week', goodWhenUp: true }}
          to={to('/candidates?bucket=recommended')}
        />
        <KpiCard
          tone="red"
          icon={<PersonXIcon />}
          label="Rejected"
          value={kpis.rejected}
          delta={{ value: kpis.rejectedThisWeek, label: 'this week' }}
          to={to('/candidates?bucket=rejected')}
        />
        <KpiCard
          icon={<CalendarPlusIcon />}
          label="New this week"
          value={kpis.newThisWeek}
          delta={{ value: kpis.newThisWeek - kpis.newPrevWeek, label: 'vs last week', goodWhenUp: true }}
          spark={spark}
          to={to('/candidates?bucket=new-this-week')}
        />
        <KpiCard
          icon={<ShareIcon />}
          label="Referred"
          value={kpis.referredCount}
          sub={`${kpis.referredPercent}% of total`}
          percent={kpis.referredPercent}
          to={to('/candidates?referred=1')}
        />
      </div>
      <div className="kpi-strip__dots" aria-hidden="true">
        {Array.from({ length: TILE_COUNT }, (_, i) => (
          <span key={i} className={cn('kpi-strip__dot', i === active && 'kpi-strip__dot--on')} />
        ))}
      </div>
    </div>
  );
}
