import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../ToastStack';
import { recordOfferDecision } from '../../services/api';
import type { Offer } from '../../types';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioOption } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface OfferDecisionModalProps {
  candidateId: number;
  offer: Offer;
  show: boolean;
  onHide: () => void;
}

export default function OfferDecisionModal({
  candidateId,
  offer,
  show,
  onHide,
}: OfferDecisionModalProps) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [decision, setDecision] = useState<'Accepted' | 'Declined'>('Accepted');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => recordOfferDecision(candidateId, offer.id, { decision, reason: reason.trim() || undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['candidate-offers', candidateId] });
      void queryClient.invalidateQueries({ queryKey: ['candidate', candidateId] });
      void queryClient.invalidateQueries({ queryKey: ['candidates'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      addToast(
        decision === 'Accepted'
          ? 'Candidate marked as Offer Accepted!'
          : 'Candidate marked as Offer Declined',
        decision === 'Accepted' ? 'success' : 'info'
      );
      onHide();
    },
    onError: (err: any) => {
      const msg = err?.response?.data || 'Failed to record decision.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (decision === 'Declined' && !reason.trim()) {
      setError('Please provide a reason when an offer is declined.');
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={show} onOpenChange={(open) => { if (!open) { (onHide)(); } }}>
<DialogContent>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Record Candidate Offer Decision</DialogTitle>
        </DialogHeader>

        <DialogBody>
          {error && <div className="alert alert-danger py-2 mb-4 text-[length:var(--text-sm)]">{error}</div>}

          {/* A real radio group rather than two loose inputs sharing a name:
              Radix gives it roving focus and arrow-key movement, and announces
              the set as one control with two options. */}
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-[length:var(--text-sm)] font-semibold text-text-soft">
              Decision
            </legend>
            <RadioGroup
              className="grid-flow-col justify-start gap-6"
              value={decision}
              onValueChange={(v) => setDecision(v as typeof decision)}
            >
              <RadioOption value="Accepted" id="dec-accepted">
                Offer accepted
              </RadioOption>
              <RadioOption value="Declined" id="dec-declined">
                Offer declined
              </RadioOption>
            </RadioGroup>
          </fieldset>

          {decision === 'Declined' && (
            <div className="flex flex-col gap-1.5 mb-4">
              <Label className="text-[length:var(--text-sm)] font-semibold">Decline Reason</Label>
              <Textarea
                rows={3}
                required
                placeholder="e.g. Accepted competing offer, salary expectations, relocation issues..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}

          <p className="text-[length:var(--text-sm)] text-muted-foreground mb-0">
            {decision === 'Accepted'
              ? 'This will update the candidate status to "Offer Accepted". You can subsequently confirm their start and transition them to "Hired".'
              : 'This will update the candidate status to "Offer Declined" and record the reason in their timeline history.'}
          </p>
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={onHide} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            
            type="submit"
            disabled={mutation.isPending}
            >
            {mutation.isPending ? 'Recording...' : `Confirm ${decision}`}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
</Dialog>
  );
}
