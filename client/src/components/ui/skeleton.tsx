import type * as React from 'react';
import { cn } from '@/lib/utils';

/** A shape standing in for content that is coming. It holds the height the
 *  content will occupy, so the page does not jump when data lands. Marked
 *  aria-hidden by the callers that wrap it — it is decoration, not status. */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-muted animate-pulse rounded-[var(--radius-md)]', className)}
      {...props}
    />
  );
}

export { Skeleton };
