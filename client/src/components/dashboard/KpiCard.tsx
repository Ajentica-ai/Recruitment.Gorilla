import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useCountUp } from '../../hooks/useCountUp';
import { cn } from '@/lib/utils';

/**
 * `neutral` is the default and should be most tiles. The remaining tones exist
 * for figures that carry a judgement — "recommended" is good news, "rejected"
 * is not — and resolve to the semantic palette in index.css, not to six
 * decorative hues. A tile whose number is neither good nor bad takes
 * `neutral`; colouring it says something the number doesn't.
 */
export type KpiTone = 'neutral' | 'orange' | 'teal' | 'green' | 'red' | 'blue' | 'purple';

/** A change against an earlier period, e.g. `{ value: 3, label: 'vs last week' }`. */
export interface KpiDelta {
  value: number;
  label: string;
  /** Tint a rise green. Only for figures where more is plainly good news. */
  goodWhenUp?: boolean;
}

interface KpiCardProps {
  label: string;
  value: number | string;
  sub?: string;
  /** 0–100. Drives the progress bar + right-aligned %; omit to hide the bar. */
  percent?: number;
  /** Shown in place of `sub` when set. */
  delta?: KpiDelta;
  /** Daily counts, oldest first; the last 7 are drawn as "this week". */
  spark?: number[];
  /** Defaults to `neutral` — most tiles should stay neutral. */
  tone?: KpiTone;
  icon: ReactNode;
  /**
   * Where the tile drills through to. Only pass one when the destination shows
   * *exactly* the same set this tile counts — a stat that opens a list with a
   * different total is worse than a stat that doesn't open at all. Tiles
   * without it render as plain, non-interactive figures.
   */
  to?: string;
}

/** "up 3 vs last week" for the accessible name; the glyph is for the eye only. */
const deltaPhrase = (d: KpiDelta) =>
  d.value === 0 ? `no change ${d.label}` : `${d.value > 0 ? 'up' : 'down'} ${Math.abs(d.value)} ${d.label}`;

/**
 * Stat tile: a label, a large figure, one line of context (a share, or a
 * change against last week), and an optional hairline bar or sparkline.
 *
 * What this stopped doing: the tile used to render its percentage twice — once
 * as a right-aligned number and once as the width of a coloured progress bar —
 * beside a filled colour chip carrying a decorative icon, in one of six hues
 * assigned by position in the row. Six saturated fills side by side gave the
 * eye no way to rank the tiles and made a dashboard of four numbers the
 * busiest screen in the product. The figure is the content; everything else on
 * the tile is there to say what the figure counts.
 */
export default function KpiCard({ label, value, sub, percent, delta, spark, tone = 'neutral', icon, to }: KpiCardProps) {
  const numeric = typeof value === 'number';
  const counted = useCountUp(numeric ? value : 0);
  const display = numeric ? value.toLocaleString() : value;
  const drawn = numeric ? counted.toLocaleString() : value;
  const max = spark && spark.length ? Math.max(1, ...spark) : 1;

  const body = (
    <>
      <div className="kpi-card__top">
        <div className="metric-label">{label}</div>
        <div className="kpi-card__top-right">
          {/* Persistent, not hover-only: a cue that appears only under the
              pointer can't tell you the tile is a link before you find it, and
              these sit beside tiles that aren't. */}
          {to && (
            <ArrowUpRight
              size={14}
              strokeWidth={2.25}
              aria-hidden="true"
              className="kpi-card__go"
            />
          )}
          <div className="kpi-card__icon">{icon}</div>
        </div>
      </div>

      {/* The animated digits are decoration; the real figure is in the name. */}
      <div className="metric-value" aria-hidden="true">{drawn}</div>
      <span className="sr-only">{display}</span>

      <div className="kpi-card__foot">
        {delta ? (
          <>
            <span
              className={cn(
                'kpi-delta',
                delta.goodWhenUp && delta.value > 0 && 'kpi-delta--good',
              )}
            >
              {delta.value !== 0 && <span aria-hidden="true">{delta.value > 0 ? '▲' : '▼'}</span>}
              <span className="sr-only">{delta.value > 0 ? 'up ' : delta.value < 0 ? 'down ' : ''}</span>
              {delta.value === 0 ? 'No change' : Math.abs(delta.value).toLocaleString()}
            </span>
            <span className="kpi-card__sub">{delta.label}</span>
          </>
        ) : (
          <span className="kpi-card__sub">{sub}</span>
        )}
      </div>

      {spark && spark.length > 0 ? (
        <div className="kpi-spark" aria-hidden="true">
          {spark.map((n, i) => (
            <span
              key={i}
              className={cn('kpi-spark__bar', i >= spark.length - 7 && 'kpi-spark__bar--now')}
              style={{ height: n === 0 ? undefined : `${Math.max(20, (n / max) * 100)}%` }}
            />
          ))}
        </div>
      ) : (
        percent !== undefined && (
          <div className="kpi-card__bar">
            <div
              className="kpi-card__bar-fill"
              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
            />
          </div>
        )
      )}
    </>
  );

  const className = `pulse-card kpi-card kpi--${tone}`;
  const context = delta ? `, ${deltaPhrase(delta)}` : sub ? `, ${sub}` : '';

  if (!to) return <div className={className}>{body}</div>;

  return (
    <Link
      to={to}
      className={`${className} kpi-card--link`}
      aria-label={`${label}: ${display}${context}. View these candidates.`}
    >
      {body}
    </Link>
  );
}
