import { ChevronDown } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A native `<select>`, styled to match `<SelectTrigger>` exactly.
 *
 * WHY NOT RADIX SELECT EVERYWHERE. Radix reserves the empty string: an
 * `<SelectItem value="">` throws, because "" is how it represents *no
 * selection*. Almost every select in this app opens with a placeholder option
 * carrying exactly that value — "Select status", "All Job Openings", "None" —
 * so converting them would mean inventing a sentinel value per call site and
 * mapping it back on the way in and out. That is a lot of moving parts to add
 * to a control whose options are six words of plain text.
 *
 * So: `<Select>` (Radix) is for the cases that genuinely need custom option
 * rendering — a status dot, a two-line option, a disabled reason. Everything
 * else uses this. It is one element, it is correct on mobile (the OS wheel
 * picker), it needs no portal, and the two are visually indistinguishable.
 *
 * The chevron is a sibling rather than `appearance: auto`, so the glyph is the
 * same one the Radix trigger uses instead of the platform's.
 */
function NativeSelect({
  className,
  wrapperClassName,
  size = 'default',
  children,
  ...props
}: Omit<React.ComponentProps<'select'>, 'size'> & {
  size?: 'sm' | 'default';
  /**
   * Classes for the positioning wrapper rather than the <select>.
   *
   * The chevron is a sibling of the control, so anything that decides whether
   * the control EXISTS on screen — `md:hidden`, a flex basis, a column span —
   * has to land on the wrapper. Passing `md:hidden` through `className` hid
   * the select and left its chevron floating in the toolbar, which is exactly
   * what happened to the small-screen sort control.
   */
  wrapperClassName?: string;
}) {
  return (
    <div className={cn('relative min-w-0', wrapperClassName)}>
      <select
        data-slot="native-select"
        className={cn(
          'w-full appearance-none rounded-[var(--radius-control)] border border-border bg-muted',
          'py-1 pr-8 pl-2.5 text-[length:var(--text-md)] text-foreground shadow-[var(--shadow-xs)]',
          'transition-[color,background-color,border-color,box-shadow] duration-[var(--dur-fast)]',
          size === 'sm'
            ? 'h-[var(--control-h-sm)] text-[length:var(--text-sm)]'
            : 'h-[var(--control-h)]',
          'hover:not-focus:border-[var(--border-strong)]',
          'focus-visible:border-ring focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] outline-none',
          'disabled:pointer-events-none disabled:bg-sunken disabled:text-muted-foreground',
          'aria-invalid:border-destructive',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  );
}

export { NativeSelect };
