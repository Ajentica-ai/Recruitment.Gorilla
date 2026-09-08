import type { ReactNode } from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The "nothing here" panel, and — via `variant="error"` — the "this failed"
 * one. Replaces the bare `<p className="text-muted-foreground">No X found.</p>` that each
 * list page had its own version of.
 *
 * Three states are worth distinguishing and usually aren't:
 *   - an empty collection ("no candidates exist yet" — say how to make one)
 *   - an empty result ("nothing matches this filter" — say to loosen it)
 *   - a failure ("the request failed" — say how to retry)
 * Pass `description` for the first two; pass `variant="error"` for the third.
 * A failure rendered in the neutral empty style reads as "there is genuinely
 * nothing here", which is a different and wrong message.
 *
 * NOT dashed. A dashed border is the convention for "drop something here",
 * which is exactly what the CV dropzone is — using it for an ordinary empty
 * result made a filtered list look like an interactive target.
 */
export default function EmptyState({
  title,
  description,
  action,
  icon,
  variant = 'empty',
  page = false,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Overrides the default glyph. Pass `null` to drop it entirely. */
  icon?: ReactNode | null;
  variant?: 'empty' | 'error';
  page?: boolean;
}) {
  const isError = variant === 'error';
  const glyph =
    icon === null
      ? null
      : (icon ??
        (isError ? (
          <AlertTriangle className="size-5" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Inbox className="size-5" strokeWidth={1.75} aria-hidden="true" />
        )));

  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-[var(--radius-card)] border px-5 text-center',
        page ? 'py-16' : 'py-12',
        isError
          ? 'border-[var(--danger-border)] bg-danger-muted'
          : 'border-border bg-card shadow-[var(--shadow-sm)]',
      )}
      // A failure is announced; an empty list is just the (visible) result.
      role={isError ? 'alert' : undefined}
    >
      {glyph && (
        <span
          className={cn(
            'mb-3 grid size-10 place-items-center rounded-full',
            isError ? 'bg-card text-destructive' : 'bg-muted text-text-faint',
          )}
        >
          {glyph}
        </span>
      )}
      <div className="text-[length:var(--text-lg)] font-bold tracking-[var(--tracking-tight)] text-foreground">
        {title}
      </div>
      {description && (
        <div className="mt-1 max-w-[52ch] text-[length:var(--text-sm)] leading-[var(--leading-normal)] text-muted-foreground">
          {description}
        </div>
      )}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
