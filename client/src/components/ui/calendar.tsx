import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';

import { cn } from '@/lib/utils';

/**
 * A month grid, styled from the Harbor tokens.
 *
 * WHY THIS EXISTS. The date filters were `<Input type="datetime-local">`. That
 * is a real shadcn Input, but the moment the field carries a date type the
 * browser draws its own picker on top of it: the `mm/dd/yyyy --:-- --`
 * placeholder, the spin arrows, and a calendar popup rendered by the browser
 * chrome that no stylesheet can reach. So one control in the toolbar looked
 * like a different product, in a way that could not be fixed by styling the
 * input.
 *
 * react-day-picker supplies the calendar behaviour — keyboard grid navigation,
 * month paging, locale-aware weekday order, the accessibility semantics — and
 * every visual class below is ours, so the popup matches the app instead of
 * the operating system.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-2', className)}
      classNames={{
        months: 'flex flex-col gap-3',
        month: 'flex flex-col gap-3',
        month_caption: 'flex h-[var(--control-h-sm)] items-center justify-center px-8',
        caption_label: 'text-[length:var(--text-md)] font-semibold text-foreground',
        nav: 'flex items-center justify-between absolute inset-x-2 top-2',
        button_previous: cn(
          'inline-flex size-[var(--control-h-sm)] items-center justify-center',
          'rounded-[var(--radius-md)] text-muted-foreground',
          'hover:bg-muted hover:text-foreground',
          'focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] outline-none',
          'disabled:pointer-events-none disabled:opacity-40',
        ),
        button_next: cn(
          'inline-flex size-[var(--control-h-sm)] items-center justify-center',
          'rounded-[var(--radius-md)] text-muted-foreground',
          'hover:bg-muted hover:text-foreground',
          'focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] outline-none',
          'disabled:pointer-events-none disabled:opacity-40',
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday:
          'w-8 text-[length:var(--text-2xs)] font-semibold uppercase text-muted-foreground',
        week: 'flex w-full mt-0.5',
        day: 'size-8 p-0 text-center',
        day_button: cn(
          'size-8 rounded-[var(--radius-md)] text-[length:var(--text-sm)] font-normal text-foreground',
          'transition-colors duration-[var(--dur-fast)]',
          'hover:bg-muted',
          'focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] outline-none',
        ),
        selected:
          '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:font-semibold [&>button]:hover:bg-primary',
        // Today is marked by weight and a ring, not by a fill — a fill would be
        // indistinguishable from the selected day.
        today: '[&>button]:font-bold [&>button]:text-brand',
        outside: '[&>button]:text-text-faint',
        disabled: '[&>button]:pointer-events-none [&>button]:opacity-40',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === 'left' ? (
            <ChevronLeft className="size-4" {...rest} />
          ) : (
            <ChevronRight className="size-4" {...rest} />
          ),
      }}
      {...props}
    />
  );
}

export { Calendar };
