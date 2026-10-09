import { useRef, useState, type KeyboardEvent } from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ApplicationsSummary, TrendPoint } from '../../types';

const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const short = (iso: string) => parse(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const long = (iso: string) =>
  parse(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * New candidates per day as bars, under a headline of the period's total and
 * its change against the period before.
 *
 * Bars rather than the old area curve: most days have zero or one new
 * candidate, and a smoothed line drew those as hills between days that never
 * happened. Tap or arrow through the bars to read a day. The busiest day is
 * selected to start with. Callers key this by range so the selection resets.
 */
export default function TrendChart({
  data,
  summary,
  days,
}: {
  data: TrendPoint[];
  summary?: ApplicationsSummary;
  days: number;
}) {
  const counts = data.map((p) => p.count);
  const max = Math.max(1, ...counts);
  const peak = counts.indexOf(Math.max(0, ...counts));
  const [picked, setPicked] = useState<number | null>(null);
  const sel = picked !== null && picked < data.length ? picked : peak;
  const bars = useRef<(HTMLButtonElement | null)[]>([]);

  const total = summary?.total ?? counts.reduce((a, b) => a + b, 0);
  const delta = summary ? summary.total - summary.previousTotal : null;

  if (data.length === 0 || total === 0) {
    return <p className="mb-0 text-muted-foreground">No applications in the last {days} days.</p>;
  }

  // Roving focus: one tab stop for the whole chart, arrows move between days.
  const onKey = (e: KeyboardEvent) => {
    const next = e.key === 'ArrowRight' ? sel + 1 : e.key === 'ArrowLeft' ? sel - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? data.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const i = Math.max(0, Math.min(data.length - 1, next));
    setPicked(i);
    bars.current[i]?.focus();
  };

  const mid = Math.floor((data.length - 1) / 2);

  return (
    <div className="flex flex-col gap-3">
      <div className="trend-head">
        <span className="trend-head__total">{total.toLocaleString()}</span>
        <span className="trend-head__label">new in the last {days} days</span>
        {delta !== null && (
          <span className={cn('kpi-delta', delta > 0 && 'kpi-delta--good')}>
            {delta !== 0 && <span aria-hidden="true">{delta > 0 ? '▲' : '▼'}</span>}
            <span className="sr-only">{delta > 0 ? 'up ' : delta < 0 ? 'down ' : ''}</span>
            {delta === 0 ? 'Same as' : Math.abs(delta).toLocaleString()} {delta === 0 ? '' : 'vs '}prior {days} days
          </span>
        )}
      </div>

      <div className="trend-readout" aria-live="polite">
        <CalendarDays size={14} strokeWidth={1.75} aria-hidden="true" />
        <span>{long(data[sel].date)}:</span>
        <b>{data[sel].count} new</b>
      </div>

      <div
        className={cn('trend-bars', `trend-bars--d${days}`)}
        role="group"
        aria-label={`New candidates per day, last ${days} days`}
        onKeyDown={onKey}
      >
        <div className="trend-bars__grid" style={{ top: 'var(--space-4)' }} />
        <div className="trend-bars__grid" style={{ top: '50%' }} />
        <span className="trend-bars__max" aria-hidden="true">{max}</span>
        {data.map((p, i) => (
          <button
            key={p.date}
            ref={(el) => {
              bars.current[i] = el;
            }}
            type="button"
            tabIndex={i === sel ? 0 : -1}
            aria-pressed={i === sel}
            aria-label={`${short(p.date)}: ${p.count} new`}
            title={`${short(p.date)}: ${p.count} new`}
            className={cn('trend-bar', p.count === 0 && 'trend-bar--zero', i === sel && 'trend-bar--on')}
            style={p.count === 0 ? undefined : { height: `${Math.max(6, (p.count / max) * 100)}%` }}
            onClick={() => setPicked(i)}
          />
        ))}
      </div>

      <div className="trend-axis" aria-hidden="true">
        <span>{short(data[0].date)}</span>
        <span>{short(data[mid].date)}</span>
        <span>{short(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}
