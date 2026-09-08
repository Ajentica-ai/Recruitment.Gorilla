import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A segmented control: ONE setting with several values — a date range
 * (7D/30D/90D), a view mode (Table/Board), a density.
 *
 * The selected segment is a RAISED surface inside a recessed track. That
 * physical metaphor is what makes the control legible at a glance, and it is
 * what distinguishes it from the two things it kept being confused with: a
 * row of buttons (the old Table/Board switcher rendered its active side as
 * `.btn-primary`, so it looked like the page's primary action) and a tab strip
 * (which navigates between panels rather than setting a value).
 *
 * Built on Radix's ToggleGroup for roving focus and arrow-key movement, since
 * the previous implementation was a plain row of buttons and had neither.
 */
function Segmented({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="segmented"
      className={cn(
        'inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-[var(--radius-control)] border border-border bg-muted p-[3px]',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      {...props}
    />
  );
}

function SegmentedItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="segmented-item"
      className={cn(
        'inline-flex h-[calc(var(--control-h)-8px)] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-2.5',
        'rounded-[var(--radius-sm)] text-[length:var(--text-sm)] font-medium text-muted-foreground',
        'transition-[background-color,color,box-shadow] duration-[var(--dur-fast)]',
        'hover:text-foreground',
        'data-[state=on]:bg-card data-[state=on]:font-semibold data-[state=on]:text-foreground data-[state=on]:shadow-[var(--shadow-xs)]',
        'focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] outline-none',
        'disabled:pointer-events-none disabled:opacity-55',
        '[&_svg]:size-3.5 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    />
  );
}

export { Segmented, SegmentedItem };
