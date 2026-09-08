import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The modal, on Radix.
 *
 * Two things this fixes beyond styling. Radix's Dialog traps focus and returns
 * it to the trigger on close, which react-bootstrap's Modal only approximates;
 * and the content is portalled to the body, so a dialog opened from inside a
 * scrolling panel no longer inherits that panel's clipping.
 *
 * Below `sm` it is a bottom sheet rather than a centred card: a centred dialog
 * on a 360px viewport wastes the edges and puts its actions out of thumb
 * reach. That is the `sm:` prefix work in DialogContent.
 */
function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 z-[var(--z-backdrop)] bg-[var(--backdrop-bg)]',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { showCloseButton?: boolean }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'fixed z-[var(--z-modal)] flex flex-col gap-0 bg-card text-card-foreground shadow-[var(--shadow-lg)]',
          // Phone: a bottom sheet pinned to the viewport edges.
          'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[var(--radius-2xl)] border-t border-border',
          'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4',
          'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-4',
          // sm and up: a centred dialog.
          'sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-lg',
          'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-2xl)] sm:border',
          'sm:max-h-[calc(100dvh-4rem)]',
          'sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95',
          'sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className={cn(
              'absolute top-3 right-3 grid size-7 place-items-center rounded-[var(--radius-md)]',
              'text-muted-foreground transition-colors duration-[var(--dur-fast)]',
              'hover:bg-muted hover:text-foreground',
              'focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] outline-none',
              'disabled:pointer-events-none',
            )}
          >
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        'flex flex-col gap-1 border-b border-line px-[var(--card-pad)] py-[var(--space-3)] pr-10',
        className,
      )}
      {...props}
    />
  );
}

/** The scrolling middle. Its own element so the header and footer stay pinned
 *  while a long form moves — the thing a sheet on a phone most needs. */
function DialogBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-body"
      className={cn('min-h-0 flex-1 overflow-y-auto p-[var(--card-pad)]', className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'flex flex-col-reverse gap-2 border-t border-line px-[var(--card-pad)] py-[var(--space-3)]',
        // On a phone the primary action goes full width and leads, under the
        // thumb, rather than tucked beside a Cancel.
        'pb-[max(var(--space-3),env(safe-area-inset-bottom))]',
        'sm:flex-row sm:justify-end sm:pb-[var(--space-3)]',
        '[&>*]:w-full sm:[&>*]:w-auto',
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        'text-[length:var(--text-lg)] font-bold leading-[var(--leading-tight)] tracking-[var(--tracking-tight)]',
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-[length:var(--text-sm)] text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
