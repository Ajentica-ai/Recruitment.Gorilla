import * as React from 'react';
import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-20 w-full rounded-[var(--radius-control)] border border-border bg-muted px-2.5 py-2',
        'text-[length:var(--text-md)] leading-[var(--leading-normal)] text-foreground shadow-[var(--shadow-xs)]',
        'placeholder:text-text-faint field-sizing-content',
        'transition-[color,background-color,border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)]',
        'hover:not-focus:border-[var(--border-strong)]',
        'focus-visible:border-ring focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] outline-none',
        'disabled:pointer-events-none disabled:bg-sunken disabled:text-muted-foreground',
        'aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
