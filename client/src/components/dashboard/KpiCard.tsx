import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

/**
 * `neutral` is the default and should be most tiles. The remaining tones exist
 * for figures that carry a judgement — "recommended" is good news, "rejected"
 * is not — and resolve to the semantic palette in index.css, not to six
 * decorative hues. A tile whose number is neither good nor bad takes
 * `neutral`; colouring it says something the number doesn't.
 */
export type KpiTone = 'neutral' | 'orange' | 'teal' | 'green' | 'red' | 'blue' | 'purple';

interface KpiCardProps {
  label: string;
  value: number | string;
  sub?: string;
  /** 0–100. Drives the progress bar + right-aligned %; omit to hide the bar. */
  percent?: number;
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

/**
 * Stat tile: a label, a large figure, one line of context, and a hairline bar
 * for the share.
 *
 * What this stopped doing: the tile used to render its percentage twice — once
 * as a right-aligned number and once as the width of a coloured progress bar —
 * beside a filled colour chip carrying a decorative icon, in one of six hues
 * assigned by position in the row. Six saturated fills side by side gave the
 * eye no way to rank the tiles and made a dashboard of four numbers the
 * busiest screen in the product. The figure is the content; everything else on
 * the tile is there to say what the figure counts.
 */
export default function KpiCard({ label, value, sub, percent, tone = 'neutral', icon, to }: KpiCardProps) {
  const display = typeof value === 'number' ? value.toLocaleString() : value;

  const body = (
    <>
      <div className="kpi-card__top">
        <div className="metric-label">{label}</div>
        <div className="kpi-card__top-right">
          {/* Persistent, not hover-only: a cue that appears only under the
              pointer can't tell you the tile is a link before you find it, and
              these sit beside tiles that aren't. Grouped with the icon in the
              action corner rather than inline with the label (where a longer
              label wrapped it onto its own line) or in the foot (where it
              truncated "All candidates"). */}
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

      <div className="metric-value">{display}</div>

      {/* One line, not a caption on the left and the same percentage repeated
          as a number on the right and a third time as the bar's width below.
          `sub` carries the share where there is one. */}
      <div className="kpi-card__foot">
        <span className="kpi-card__sub">{sub}</span>
      </div>

      {percent !== undefined && (
        <div className="kpi-card__bar">
          <div
            className="kpi-card__bar-fill"
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      )}
    </>
  );

  const className = `pulse-card kpi-card kpi--${tone}`;

  if (!to) return <div className={className}>{body}</div>;

  return (
    <Link
      to={to}
      className={`${className} kpi-card--link`}
      aria-label={`${label}: ${display}. View these candidates.`}
    >
      {body}
    </Link>
  );
}
