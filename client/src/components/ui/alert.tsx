import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * An inline notice about the state of the thing on screen — a closed job
 * opening, a failed save, a pending password. Not a toast: a toast reports an
 * action's outcome and leaves; this stays because the condition it describes
 * is still true.
 */
const alertVariants = cva(
  'relative flex w-full items-start gap-2.5 rounded-[var(--radius-lg)] border px-3 py-2.5 text-[length:var(--text-sm)] leading-[var(--leading-normal)] [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:translate-y-px',
  {
    variants: {
      variant: {
        info: 'border-[var(--info-border)] bg-info-muted text-info-foreground',
        success: 'border-[var(--success-border)] bg-success-muted text-success-foreground',
        warning: 'border-[var(--warning-border)] bg-warning-muted text-[var(--warning-text-strong)]',
        danger: 'border-[var(--danger-border)] bg-danger-muted text-[var(--danger-text)]',
        neutral: 'border-border bg-muted text-text-soft',
      },
    },
    defaultVariants: { variant: 'info' },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="alert-title" className={cn('font-semibold', className)} {...props} />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert-description" className={cn('min-w-0', className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
