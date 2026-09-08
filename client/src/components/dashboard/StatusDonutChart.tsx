import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useTheme } from '../../theme/ThemeContext';
import { chartChrome, statusColorMap } from '../../utils/chartColors';
import { StatusBadge } from '../StatusBadge';
import type { StatusCount } from '../../types';

/**
 * Donut of the full current-status breakdown, with the total in the centre. The
 * legend reuses StatusBadge pills so colors are consistent with the rest of the app.
 */
export default function StatusDonutChart({ data }: { data: StatusCount[] }) {
  const { theme } = useTheme();
  const chrome = chartChrome(theme);

  const slices = useMemo(() => data.filter((d) => d.count > 0), [data]);
  const colors = useMemo(
    () => statusColorMap(slices.map((s) => s.status)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slices, theme]
  );
  const total = useMemo(() => slices.reduce((sum, s) => sum + s.count, 0), [slices]);

  if (slices.length === 0) {
    return <p className="text-muted-foreground mb-0">No candidates yet.</p>;
  }

  return (
    <div className="flex flex-col flex-sm-row items-center gap-4">
      <div style={{ position: 'relative', width: 200, height: 200, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="count"
              nameKey="status"
              innerRadius={62}
              outerRadius={92}
              paddingAngle={2}
              stroke="none"
            >
              {slices.map((s) => (
                <Cell key={s.status} fill={colors[s.status]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: chrome.tooltipBg,
                border: `1px solid ${chrome.tooltipBorder}`,
                borderRadius: 8,
                color: chrome.tooltipText,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div
          className="absolute top-50 start-50 translate-middle text-center"
          style={{ pointerEvents: 'none' }}
        >
          <div className="font-bold leading-none" style={{ fontSize: '1.6rem' }}>
            {total}
          </div>
          <div className="text-muted-foreground text-[length:var(--text-sm)]">total</div>
        </div>
      </div>
      <div className="flex flex-col gap-1 w-full" style={{ maxHeight: 200, overflowY: 'auto' }}>
        {slices.map((s) => (
          <div key={s.status} className="flex justify-between items-center gap-2">
            <StatusBadge status={s.status} />
            <span className="text-muted-foreground text-[length:var(--text-sm)]">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
