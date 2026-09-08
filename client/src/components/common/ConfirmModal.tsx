import type { ReactNode } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Confirmation dialog for a destructive action. Replaces the near-identical
 * delete modal that CandidatesPage, UsersPage and ConfigurationPage each had
 * their own copy of.
 *
 * `show` is derived from the caller's "what am I deleting" state rather than
 * a separate boolean, so the two can't drift out of step.
 *
 * This is the ONE place `variant="destructive"` is used — a filled red button.
 * Everywhere else a delete is offered (a row's overflow menu, a page header)
 * it is a ghost that only turns red on hover, so the alarm is spent at the
 * moment of danger rather than on every row of every list.
 */
export default function ConfirmModal({
  show,
  title,
  children,
  confirmLabel = 'Delete',
  pendingLabel,
  confirmVariant = 'destructive',
  pending = false,
  error,
  onConfirm,
  onCancel,
}: {
  show: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  /**
   * The in-flight label. Defaults to a naive "-ing" of `confirmLabel`, which
   * is right for the single-verb labels ("Delete" → "Deleting…") but not for a
   * phrase — "Submit & lock" would become "Submit & locking…". Pass it
   * explicitly whenever the label is more than one word.
   */
  pendingLabel?: string;
  confirmVariant?: 'destructive' | 'default';
  pending?: boolean;
  /** Shown inside the dialog, so the failure appears where the action was taken. */
  error?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const busyLabel = pendingLabel ?? `${confirmLabel.replace(/e$/, '')}ing…`;

  return (
    <Dialog open={show} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {/* The body IS the description, so it is announced with the title
              rather than being an unlabelled region after it. */}
          <DialogDescription asChild>
            <div className="text-[length:var(--text-md)] leading-[var(--leading-normal)] text-text-soft">
              {children}
            </div>
          </DialogDescription>
          {error && <Alert variant="danger">{error}</Alert>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={confirmVariant} disabled={pending} onClick={onConfirm}>
            {pending ? busyLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
