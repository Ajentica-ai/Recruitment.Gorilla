import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * The button, on shadcn's anatomy and Harbor's geometry.
 *
 * THREE WEIGHTS CARRY MEANING, and only three:
 *   default   filled cobalt. ONE per view — the thing to do next.
 *   outline   a bordered surface. The everyday choice.
 *   ghost     no chrome until hovered, for actions that live INSIDE content
 *             (a table row, a card head, a toolbar) where a border would draw
 *             a box around a box.
 *
 * Destructive is deliberately NOT a fourth weight. `destructive` exists for
 * the confirm dialog's own button and nothing else; a delete offered in a row
 * or a header is a `ghost` that turns red on hover (`ghostDestructive`), so the
 * warning arrives at the moment of danger rather than forty times per screen.
 *
 * `asChild` renders the styles onto a child element — the reason a router
 * <Link> can be a button without nesting an <a> inside a <button>.
 */
const buttonVariants = cva(
  // Layout, type and interaction shared by every variant. `shrink-0` on the
  // icon and the fixed icon size stop a long label from squashing the glyph.
  [
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap',
    'rounded-[var(--radius-control)] font-semibold',
    'transition-[background-color,border-color,color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)]',
    'outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] focus-visible:border-ring',
    'disabled:pointer-events-none disabled:opacity-55',
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
    'aria-invalid:border-destructive',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[var(--shadow-accent)] hover:bg-[var(--primary)] active:shadow-none disabled:shadow-none',
        outline:
          'border border-[var(--border-strong)] bg-card text-text-soft shadow-[var(--shadow-xs)] hover:bg-muted hover:text-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-[var(--surface-sunken)]',
        ghost: 'text-text-soft hover:bg-muted hover:text-foreground',
        ghostDestructive:
          'text-text-soft hover:bg-danger-muted hover:text-[var(--danger-text)]',
        outlineDestructive:
          'border border-[var(--danger-border)] bg-card text-[var(--danger-text)] shadow-[var(--shadow-xs)] hover:bg-danger-muted',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-[var(--danger-text)] focus-visible:ring-[color-mix(in_srgb,var(--danger)_30%,transparent)]',
        link: 'text-brand underline-offset-4 hover:underline',
      },
      size: {
        // Heights come from the control tokens, so a button, an input and a
        // select on one row sit on the same rail at every density.
        default: 'h-[var(--control-h)] px-3 text-[length:var(--text-md)]',
        sm: 'h-[var(--control-h-sm)] gap-1 px-2.5 text-[length:var(--text-sm)] rounded-[var(--radius-md)]',
        lg: 'h-[var(--control-h-lg)] px-4 text-[length:var(--text-md)]',
        // Square, for a glyph with no label.
        icon: 'size-[var(--control-h)] px-0',
        iconSm: 'size-[var(--control-h-sm)] px-0 rounded-[var(--radius-md)]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
