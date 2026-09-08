import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * An in-flight indicator, for a button that is saving or a route resolving.
 *
 * It keeps turning under `prefers-reduced-motion`: that setting asks for less
 * decoration, not for status indicators to stop reporting status.
 */
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <LoaderCircle
      className={cn('size-4 shrink-0 animate-spin', className)}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      role={label ? 'status' : undefined}
    />
  );
}
