import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ConfirmModal from '@/components/common/ConfirmModal';
import { useToast } from './ToastStack';
import { getEvaluationShares, revokeEvaluationShare } from '../services/api';
import {
  expiryLabel,
  scopeLabel,
  serverErrorMessage,
  shareStatus,
  sourceLabel,
  type ShareStatus,
} from '@/lib/evaluationShares';
import type { EvaluationShare } from '@/types';

const STATUS_BADGE: Record<ShareStatus, { label: string; variant: BadgeVariant }> = {
  active: { label: 'Active', variant: 'success' },
  expired: { label: 'Expired', variant: 'warning' },
  revoked: { label: 'Revoked', variant: 'neutral' },
};

/**
 * Who a candidate's evaluations are shared with. Active shares are listed; revoked and expired ones
 * are collapsed behind a toggle because they are history, not something to act on. Revoking asks
 * first: it takes effect on the grantee's next request.
 */
export default function EvaluationSharesList({ candidateId }: { candidateId: number }) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [showInactive, setShowInactive] = useState(false);
  const [revoking, setRevoking] = useState<EvaluationShare | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const { data: shares = [], isLoading, error } = useQuery({
    queryKey: ['evaluation-shares', candidateId],
    queryFn: () => getEvaluationShares(candidateId),
  });

  const revoke = useMutation({
    mutationFn: (share: EvaluationShare) => revokeEvaluationShare(candidateId, share.id),
    onSuccess: (_void, share) => {
      void queryClient.invalidateQueries({ queryKey: ['evaluation-shares', candidateId] });
      addToast(`Stopped sharing with ${share.granteeName}.`);
      setRevoking(null);
      setRevokeError(null);
    },
    onError: (err) => setRevokeError(serverErrorMessage(err, 'Failed to revoke the share.')),
  });

  const active = shares.filter((s) => shareStatus(s) === 'active');
  const inactive = shares.filter((s) => shareStatus(s) !== 'active');

  if (isLoading) return <p className="form-help">Loading shares…</p>;
  if (error) {
    return (
      <p className="text-[length:var(--text-sm)] text-[var(--danger-text)]">
        Failed to load who this is shared with.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {active.length === 0 ? (
        <p className="form-help">Not shared with anyone yet.</p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Active shares">
          {active.map((share) => (
            <ShareRow key={share.id} share={share} onRevoke={() => setRevoking(share)} />
          ))}
        </ul>
      )}

      {inactive.length > 0 && (
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            aria-expanded={showInactive}
            onClick={() => setShowInactive((v) => !v)}
          >
            {showInactive ? 'Hide' : 'Show'} revoked and expired ({inactive.length})
          </Button>
          {showInactive && (
            <ul className="flex flex-col gap-3" aria-label="Revoked and expired shares">
              {inactive.map((share) => (
                <ShareRow key={share.id} share={share} />
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmModal
        show={revoking !== null}
        title="Stop sharing?"
        confirmLabel="Revoke"
        pendingLabel="Revoking…"
        pending={revoke.isPending}
        error={revokeError}
        onConfirm={() => revoking && revoke.mutate(revoking)}
        onCancel={() => {
          setRevoking(null);
          setRevokeError(null);
        }}
      >
        {revoking
          ? `${revoking.granteeName} will lose access to these evaluations on their next request.`
          : null}
      </ConfirmModal>
    </div>
  );
}

function ShareRow({ share, onRevoke }: { share: EvaluationShare; onRevoke?: () => void }) {
  const status = STATUS_BADGE[shareStatus(share)];
  return (
    <li className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--border)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{share.granteeName}</span>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>
      <p className="text-[length:var(--text-sm)] text-muted-foreground">
        {scopeLabel(share)} · {sourceLabel(share.source)}
        {share.grantedByName ? ` · by ${share.grantedByName}` : ''} · {expiryLabel(share)}
      </p>
      {share.note && (
        <p className="text-[length:var(--text-sm)] text-muted-foreground">Note: {share.note}</p>
      )}
      {onRevoke && share.source === 'PanelAutoShare' && (
        <p className="text-[length:var(--text-sm)] text-muted-foreground">
          Follows the interview's panel. Change the panel, or turn off sharing earlier rounds on that interview, to end it.
        </p>
      )}
      {onRevoke && share.source !== 'PanelAutoShare' && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          aria-label={`Revoke ${share.granteeName}`}
          onClick={onRevoke}
        >
          Revoke
        </Button>
      )}
    </li>
  );
}
