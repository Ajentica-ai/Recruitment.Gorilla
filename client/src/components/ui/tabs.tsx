import * as TabsPrimitive from '@radix-ui/react-tabs';
import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Underline tabs, for navigating between panels of one page.
 *
 * Distinct from `<Segmented>`: a segmented control is ONE setting with several
 * values and reads as a single enclosed object; tabs move between different
 * sets of content. Using the same treatment for both is why the old
 * Configuration page's tab strip and the Candidates view switcher looked
 * interchangeable when they do different things.
 *
 * The list scrolls rather than wraps — a wrapped strip changes height as tabs
 * move between rows, which shifts the content under it on every resize.
 */
function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-[var(--stack-gap)]', className)}
      {...props}
    />
  );
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'relative inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap px-3',
        'border-b-2 border-transparent -mb-px',
        'text-[length:var(--text-md)] font-semibold text-muted-foreground',
        'transition-[color,border-color,background-color] duration-[var(--dur-fast)]',
        'hover:text-foreground',
        'data-[state=active]:border-b-[var(--primary)] data-[state=active]:text-brand',
        'focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] outline-none',
        'disabled:pointer-events-none disabled:opacity-55',
        '[&_svg]:size-4 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex flex-1 flex-col gap-[var(--stack-gap)] outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
