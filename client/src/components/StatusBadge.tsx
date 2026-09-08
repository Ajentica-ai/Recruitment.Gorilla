import { getStatusClass } from '@/utils/statusColors';
import { cn } from '@/lib/utils';


/**
 * The pipeline status pill.
 *
 * The colour comes from a `.status--*` class carrying `--status-color` and
 * `--status-tint` (see index.css), not from a Tailwind variant. There are
 * seven pipeline tones, each with a light and a dark value, and they are also
 * read by the charts through a computed-style probe — one definition, three
 * consumers. Encoding them as variants here would fork that.
 *
 * The geometry matches `<Badge>` exactly: a status IS a badge, and there was
 * no reason for the one in a table cell to be a different shape from the one
 * on a card. The leading dot is the non-colour distinguisher; the label is the
 * real one.
 */
export function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5',
        'text-[length:var(--text-xs)] font-semibold leading-[var(--leading-snug)]',
        'before:size-1.5 before:shrink-0 before:rounded-full before:bg-current before:content-[""]',
        'bg-[var(--status-tint)] text-[var(--status-color)]',
        getStatusClass(status),
        className,
      )}
    >
      {status}
    </span>
  );
}

/** Solid coloured dot for the status timeline node. */
export function StatusDot({ status, style }: { status: string; style?: React.CSSProperties }) {
  return (
    <span
      className={cn(
        'inline-block size-2 shrink-0 rounded-full bg-[var(--status-color)]',
        getStatusClass(status),
      )}
      style={style}
    />
  );
}
