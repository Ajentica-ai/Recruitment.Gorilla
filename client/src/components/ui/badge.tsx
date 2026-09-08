import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * One badge geometry for the whole app.
 *
 * Status is never conveyed by colour alone: every tone carries a leading dot,
 * one SHAPE in one SIZE. The variety of glyphs this replaced (● ▲ ◆ ■ ○) was
 * an attempt to distinguish tones without colour, but five shapes at 9px are
 * not distinguishable from each other either, and the ragged silhouettes made
 * a row of badges look like debris. The real non-colour distinguisher is the
 * badge's own text; the dot's job is to carry the hue at a size the eye reads
 * as a status light.
 *
 * `neutral` and `outline` carry no dot — they label a value rather than report
 * a state, so there is no status for a colour to convey.
 */
const badgeVariants = cva(
  [
    'inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap',
    'rounded-full px-2 py-0.5 text-[length:var(--text-xs)] font-semibold leading-[var(--leading-snug)]',
    "before:size-1.5 before:shrink-0 before:rounded-full before:bg-current before:content-['']",
    '[&>svg]:size-3 [&>svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        neutral: 'bg-muted text-text-soft before:hidden',
        brand: 'bg-brand-muted text-brand',
        success: 'bg-success-muted text-success-foreground',
        warning: 'bg-warning-muted text-warning-foreground',
        danger: 'bg-danger-muted text-[var(--danger-text)]',
        info: 'bg-info-muted text-info-foreground',
        outline: 'border border-[var(--border-strong)] text-text-soft before:hidden',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';
  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

/**
 * The tone name on its own, for the several places that pick a tone from a
 * lookup table or a chain of conditions (a role, an audit action, an
 * evaluation outcome) rather than writing it inline.
 */
export type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

export { Badge, badgeVariants };
