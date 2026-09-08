import { cn } from '@/lib/utils';

/**
 * An input with a control butted against it — the search field with its submit
 * button.
 *
 * Bootstrap's InputGroup doubled the hairline between the two and, once the
 * controls carried a resting shadow, that doubling read as a seam. Here the
 * group owns the border and the children are borderless, so it renders as one
 * object rather than two touching ones.
 */
export function InputGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        'flex h-[var(--control-h)] w-full min-w-0 items-center overflow-hidden',
        'rounded-[var(--radius-control)] border border-border bg-muted shadow-[var(--shadow-xs)]',
        'transition-[border-color,box-shadow] duration-[var(--dur-fast)]',
        'focus-within:border-ring focus-within:bg-card focus-within:ring-[3px] focus-within:ring-[var(--focus-ring)]',
        '[&_[data-slot=input]]:h-full [&_[data-slot=input]]:border-0 [&_[data-slot=input]]:bg-transparent',
        '[&_[data-slot=input]]:shadow-none [&_[data-slot=input]]:focus-visible:ring-0',
        className,
      )}
      {...props}
    />
  );
}

/** A non-interactive glyph or label inside the group. */
export function InputGroupAddon({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn('grid shrink-0 place-items-center pl-2.5 text-muted-foreground', className)}
      {...props}
    />
  );
}
