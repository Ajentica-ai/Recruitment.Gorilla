import type * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

/**
 * A surface lifted off the page by a soft shadow, with a hairline to define
 * its edge. Flat border-only cards are what made the old screens read as
 * wireframes: with no elevation, a card, the toolbar above it and the table
 * inside it are all the same kind of box and the eye has nothing to order
 * them by.
 */
function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'flex flex-col rounded-[var(--radius-card)] border border-border bg-card text-card-foreground shadow-[var(--shadow-sm)]',
        className,
      )}
      {...props}
    />
  );
}

/** Head, body and foot all take the same inset, so a chart card, a form card
 *  and a table card line up internally and not just at their edges. */
function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'flex min-h-[var(--control-h)] items-center justify-between gap-3 px-[var(--card-pad)] pt-[var(--card-pad)]',
        'has-[+[data-slot=card-content]]:pb-[var(--space-3)]',
        className,
      )}
      {...props}
    />
  );
}

/** `asChild` so a section can render a real <h2>/<h3> — the heading LEVEL is
 *  the caller's semantic choice, the size is this component's visual one. */
function CardTitle({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<'div'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'div';
  return (
    <Comp
      data-slot="card-title"
      className={cn(
        'text-[length:var(--text-lg)] font-bold tracking-[var(--tracking-tight)] leading-[var(--leading-tight)]',
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('text-[length:var(--text-sm)] text-muted-foreground', className)}
      {...props}
    />
  );
}

/** The right-hand cluster in a card head. */
function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn('flex shrink-0 items-center gap-2', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('px-[var(--card-pad)] pb-[var(--card-pad)]', className)}
      {...props}
    />
  );
}

/** For a card whose content is a table or list that should meet the card's
 *  border rather than sit inside its padding. */
function CardContentFlush({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="card-content" className={cn('overflow-hidden', className)} {...props} />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        'flex items-center gap-2 border-t border-line px-[var(--card-pad)] py-[var(--space-3)]',
        className,
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardContentFlush,
  CardFooter,
};
