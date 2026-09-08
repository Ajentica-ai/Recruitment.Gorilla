import { LoaderCircle } from 'lucide-react';

import { Skeleton as Block } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Loading states.
 *
 * The app previously showed a bare spinner in five different shapes — a
 * centred one on the dashboard, an inline one on Users, a small one in the
 * config tabs — and each one collapsed the page to nothing while it span, so
 * the layout jumped when data landed.
 *
 * THE RULE: if the shape of what is coming is known, hold that shape with a
 * skeleton. Only fall back to a spinner when it isn't — an action in flight,
 * or a route still deciding what to render.
 *
 * Skeletons are `aria-hidden` and the region carries `aria-busy`, so a screen
 * reader is told "busy" once rather than reading out a wall of empty boxes.
 */

type SkeletonVariant = 'text' | 'line' | 'row' | 'card' | 'chart';

const VARIANT_CLASS: Record<SkeletonVariant, string> = {
  text: 'h-3',
  line: 'h-4',
  row: 'h-[var(--row-h)] rounded-[var(--radius-lg)]',
  card: 'h-24 rounded-[var(--radius-card)]',
  chart: 'h-56 rounded-[var(--radius-lg)]',
};

/** A single placeholder block. `width` accepts any CSS length or percentage. */
export function Skeleton({
  variant = 'line',
  width,
  className = '',
}: {
  variant?: SkeletonVariant;
  width?: string;
  className?: string;
}) {
  return (
    <Block
      className={cn(VARIANT_CLASS[variant], className)}
      style={width ? { width } : undefined}
      aria-hidden="true"
    />
  );
}

/** `count` stacked lines, the last one short so it reads as a paragraph end. */
export function SkeletonText({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Block
          key={i}
          className="h-3"
          style={{ width: i === count - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

/** Placeholder for a list or table that is still loading. */
export function SkeletonRows({ rows = 5, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div
      className="flex flex-col gap-2"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      {Array.from({ length: rows }, (_, i) => (
        <Block key={i} className="h-[var(--row-h)] rounded-[var(--radius-lg)]" aria-hidden="true" />
      ))}
    </div>
  );
}

/** Placeholder for a grid of tiles — KPI cards, job cards. Mirrors the live
 *  grid's column counts so the page doesn't reflow when the data lands. */
export function SkeletonCards({ count = 6, label = 'Loading' }: { count?: number; label?: string }) {
  return (
    <div
      className="grid grid-cols-2 gap-[var(--space-4)] md:grid-cols-3 min-[1600px]:grid-cols-6"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      {Array.from({ length: count }, (_, i) => (
        <Block key={i} className="h-24 rounded-[var(--radius-card)]" aria-hidden="true" />
      ))}
    </div>
  );
}

/**
 * Centred spinner with a label, for the cases a skeleton can't serve: a whole
 * route resolving, or work in flight with no shape to preview.
 *
 * The spinner keeps turning under `prefers-reduced-motion`. That setting asks
 * for less decoration, not for status indicators to stop reporting status.
 */
export default function LoadingPanel({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-12 text-[length:var(--text-sm)] text-muted-foreground"
      role="status"
      aria-busy="true"
    >
      <LoaderCircle className="size-5 animate-spin text-brand" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
