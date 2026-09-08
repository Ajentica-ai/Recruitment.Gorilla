import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * The field ground is `bg-muted`, not the card colour: a white input on a white
 * card is defined only by a hairline. A faint recess says "you type here"
 * before the border does, and it inverts correctly in dark mode, where the
 * input is *lighter* than the card it sits on.
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-[var(--control-h)] w-full min-w-0 rounded-[var(--radius-control)] border border-border bg-muted px-2.5 py-1',
        'text-[length:var(--text-md)] text-foreground shadow-[var(--shadow-xs)]',
        'placeholder:text-text-faint selection:bg-brand-muted',
        'transition-[color,background-color,border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)]',
        'hover:not-focus:border-[var(--border-strong)]',
        'focus-visible:border-ring focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] outline-none',
        'disabled:pointer-events-none disabled:bg-sunken disabled:text-muted-foreground',
        'file:inline-flex file:border-0 file:bg-transparent file:text-[length:var(--text-sm)] file:font-medium',
        'aria-invalid:border-destructive aria-invalid:ring-[color-mix(in_srgb,var(--danger)_25%,transparent)]',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
