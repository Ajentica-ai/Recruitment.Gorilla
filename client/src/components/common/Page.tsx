import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The root of every page.
 *
 * A page is a vertical stack of sections separated by `--stack-gap`, and this
 * is what applies that gap. Pages must not space their own sections with
 * margin utilities: the whole point is that the distance between a page header
 * and its filter bar is the same distance as between that filter bar and its
 * table, on every page, decided in one place.
 *
 * `min-w-0` so a wide child (a scrolling table) can't stretch the column past
 * the viewport and introduce a horizontal scrollbar on the page.
 */
export default function Page({
  children,
  className = '',
  /** Tighter rhythm, for a page whose sections are closely related. */
  tight = false,
}: {
  children: ReactNode;
  className?: string;
  tight?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col',
        tight ? 'gap-[var(--space-3)]' : 'gap-[var(--stack-gap)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
