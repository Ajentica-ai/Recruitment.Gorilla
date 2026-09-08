import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '../../theme/ThemeContext';
import { accentFor, chartChrome } from '../../utils/chartColors';
import type { NameCount } from '../../types';

/**
 * Single-series horizontal magnitude bars (used for by-role and top-skills).
 * One accent hue — the category labels carry identity, so no legend is needed.
 */
export default function CountBarChart({ data, emptyLabel }: { data: NameCount[]; emptyLabel: string }) {
  const { theme } = useTheme();
  const chrome = chartChrome(theme);
  const accent = accentFor(theme);

  if (data.length === 0) {
    return <p className="text-muted-foreground mb-0">{emptyLabel}</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 32)}>
      <BarChart layout="vertical" data={data} margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" allowDecimals={false} tick={{ fill: chrome.axis, fontSize: 12 }} stroke={chrome.grid} />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tick={{ fill: chrome.axis, fontSize: 12 }}
          stroke={chrome.grid}
        />
        <Tooltip
          cursor={{ fill: chrome.grid }}
          contentStyle={{
            background: chrome.tooltipBg,
            border: `1px solid ${chrome.tooltipBorder}`,
            borderRadius: 8,
            color: chrome.tooltipText,
          }}
        />
        <Bar
          dataKey="count"
          fill={accent}
          fillOpacity={theme === 'dark' ? 0.75 : 0.9}
          barSize={14}
          radius={[0, 4, 4, 0]}
          name="Candidates"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
