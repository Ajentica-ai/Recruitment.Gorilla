import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ConfirmModal from './common/ConfirmModal';
import { useToast } from './ToastStack';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cancelInterview } from '../services/api';

export interface CancelInterviewModalProps {
  interviewId: number;
  candidateId: number;
  show: boolean;
  onHide: () => void;
  onCancelled?: () => void;
}

/**
 * Cancels a booking, with a reason the interviewers are told. Reuses ConfirmModal rather than
 * being another sheet: this is a destructive, one-field action, and ConfirmModal takes `children`
 * as the body, so the reason field lives where the confirmation is given.
 */
export default function CancelInterviewModal({
  interviewId,
  candidateId,
  show,
  onHide,
  onCancelled,
}: CancelInterviewModalProps) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setReason('');
    setError(null);
    onHide();
  };

  const mutation = useMutation({
    mutationFn: () => cancelInterview(interviewId, { reason: reason.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['candidates'] });
      void queryClient.invalidateQueries({ queryKey: ['candidate', candidateId] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['my-interviews'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['interview', interviewId] });
      void queryClient.invalidateQueries({ queryKey: ['interview-schedule', interviewId] });
      // Unlike a reschedule, this one DOES move the candidate (back to Call for Interview),
      // so the available next statuses really have changed.
      void queryClient.invalidateQueries({ queryKey: ['status-options', 'next', candidateId] });
      addToast('Interview cancelled. The interviewers have been notified.');
      onCancelled?.();
      close();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to cancel the interview.');
    },
  });

  return (
    <ConfirmModal
      show={show}
      title="Cancel this interview?"
      confirmLabel="Cancel interview"
      pendingLabel="Cancelling…"
      pending={mutation.isPending}
      error={error}
      onConfirm={() => {
        if (!reason.trim()) {
          setError('A reason is required.');
          return;
        }
        mutation.mutate();
      }}
      onCancel={close}
    >
      <p className="mb-4">
        The assigned interviewers are emailed and the booking is removed from the dashboard. The
        candidate goes back to <strong>Call for Interview</strong>, so a new interview can be
        booked from there.
      </p>
      <Label className="mb-1" htmlFor="cancel-interview-reason">
        Reason
      </Label>
      <Textarea
        id="cancel-interview-reason"
        rows={3}
        placeholder="Told to the interviewers in the cancellation email"
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          setError(null);
        }}
      />
    </ConfirmModal>
  );
}
