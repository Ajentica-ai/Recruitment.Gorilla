import * as SheetPrimitive from '@radix-ui/react-dialog';
import { XIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A drawer: the evaluation report, the candidate's status history, and the
 * interview page's profile panel. Radix's Dialog underneath, so it gets the
 * same focus trap and escape handling as a modal; the difference is that it
 * comes in from the side and does not interrupt the page the way a centred
 * dialog does.
 *
 * From `sm` up it is a right-hand panel. Below `sm` it is a bottom sheet, the
 * same shape DialogContent takes, because a full-width panel sliding in
 * horizontally on a 390px screen reads as a page navigation: people then reach
 * for the browser back button, which does not dismiss it. A sheet rising from
 * the bottom sets no such expectation, and it puts the footer actions in thumb
 * reach.
 *
 * Not the mobile navigation, despite what this comment claimed until #84.
 * `shell/SidebarNav` hand-rolls that as an `<aside>` and never used this.
 */
function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-[var(--z-backdrop)] bg-[var(--backdrop-bg)]',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        )}
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'fixed z-[var(--z-modal)] flex flex-col gap-0 bg-card text-card-foreground shadow-[var(--shadow-lg)]',
          'transition ease-[var(--ease-harbor)]',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          // Phone: a bottom sheet pinned to the viewport edges. Capped rather
          // than full height, so the page stays visible above it and it reads
          // as an overlay instead of a new screen.
          'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[var(--radius-2xl)] border-t border-border',
          'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
          // sm and up: the right-hand panel, full height against the edge.
          'sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:h-full sm:max-h-none sm:w-[min(28rem,100vw)]',
          'sm:rounded-t-none sm:border-t-0 sm:border-l',
          'sm:data-[state=open]:slide-in-from-right sm:data-[state=closed]:slide-out-to-right',
          'sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            className={cn(
              'absolute top-3 right-3 grid size-7 place-items-center rounded-[var(--radius-md)]',
              'text-muted-foreground transition-colors duration-[var(--dur-fast)]',
              'hover:bg-muted hover:text-foreground',
              'focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] outline-none',
            )}
          >
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        'flex flex-col gap-1 border-b border-line px-[var(--card-pad)] py-[var(--space-3)] pr-10',
        className,
      )}
      {...props}
    />
  );
}

/** The scrolling middle, so the header and footer stay pinned.
 *
 *  Same contract as DialogBody: `flex-1 min-h-0` only works on a DIRECT flex
 *  child of SheetContent. A form wrapping header/body/footer is not a flex
 *  container, so the body stops scrolling, grows to its content and pushes the
 *  footer past the bottom edge, with no scrollbar to show anything was cut off.
 *  Give any such wrapper `className="contents"`. See #81, which fixed exactly
 *  that in all eight form dialogs. */
function SheetBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-body"
      className={cn('min-h-0 flex-1 overflow-y-auto p-[var(--card-pad)]', className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        'flex flex-col-reverse gap-2 border-t border-line px-[var(--card-pad)] py-[var(--space-3)]',
        // On a phone the primary action goes full width and leads, under the
        // thumb, and clears the home indicator. Same rules as DialogFooter.
        'pb-[max(var(--space-3),env(safe-area-inset-bottom))]',
        'sm:flex-row sm:justify-end sm:pb-[var(--space-3)]',
        '[&>*]:w-full sm:[&>*]:w-auto',
        className,
      )}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        'text-[length:var(--text-lg)] font-bold leading-[var(--leading-tight)] tracking-[var(--tracking-tight)]',
        className,
      )}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-[length:var(--text-sm)] text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
