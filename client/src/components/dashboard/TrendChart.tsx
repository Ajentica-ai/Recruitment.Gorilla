import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '../../theme/ThemeContext';
import { accentFor, chartChrome } from '../../utils/chartColors';
import type { TrendPoint } from '../../types';

/** Applications-per-day area chart over the trailing window (single accent hue). */
export default function TrendChart({ data }: { data: TrendPoint[] }) {
  const { theme } = useTheme();
  const chrome = chartChrome(theme);
  const accent = accentFor(theme);

  const hasData = useMemo(() => data.some((p) => p.count > 0), [data]);

  // Short "MMM d" tick labels; thin them so the axis doesn't crowd.
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  const interval = Math.max(0, Math.floor(data.length / 8) - 1);

  if (!hasData) {
    return <p className="text-muted-foreground mb-0">No applications in this period.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
            <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={chrome.grid} />
        <XAxis
          dataKey="date"
          tickFormatter={fmt}
          interval={interval}
          tick={{ fill: chrome.axis, fontSize: 12 }}
          stroke={chrome.grid}
        />
        <YAxis allowDecimals={false} width={32} tick={{ fill: chrome.axis, fontSize: 12 }} stroke={chrome.grid} />
        <Tooltip
          labelFormatter={(l) => fmt(String(l))}
          contentStyle={{
            background: chrome.tooltipBg,
            border: `1px solid ${chrome.tooltipBorder}`,
            borderRadius: 8,
            color: chrome.tooltipText,
          }}
        />
        <Area
          type="monotone"
          dataKey="count"
          name="Applications"
          stroke={accent}
          strokeWidth={2}
          fill="url(#trendFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
