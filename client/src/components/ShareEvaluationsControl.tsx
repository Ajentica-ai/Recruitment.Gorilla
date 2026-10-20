import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../auth/AuthContext';
import ShareEvaluationsDrawer from './ShareEvaluationsDrawer';
import { getEvaluationShares } from '../services/api';
import { shareStatus } from '@/lib/evaluationShares';

/**
 * The "Share evaluations" entry point, with the drawer it opens. Renders nothing for roles that
 * cannot write candidates (an Interviewer has no share rights and the endpoints would answer 403).
 * With `showSummary` it also says how many people the evaluations are currently shared with, and
 * that line opens the same drawer.
 */
export default function ShareEvaluationsControl({
  candidateId,
  candidateName,
  showSummary = false,
  className,
}: {
  candidateId: number;
  candidateName: string;
  showSummary?: boolean;
  className?: string;
}) {
  const { canWriteCandidates } = useAuth();
  const [open, setOpen] = useState(false);

  const { data: shares } = useQuery({
    queryKey: ['evaluation-shares', candidateId],
    queryFn: () => getEvaluationShares(candidateId),
    enabled: canWriteCandidates && showSummary,
  });

  if (!canWriteCandidates) return null;

  const sharedWith = shares
    ? new Set(shares.filter((s) => shareStatus(s) === 'active').map((s) => s.granteeUserId)).size
    : null;

  return (
    <>
      <div className={className ?? 'inline-flex flex-wrap items-center gap-2 print:hidden'}>
        <Button variant="ghost" className="btn-action-eval" onClick={() => setOpen(true)}>
          <Share2 size={15} strokeWidth={1.75} aria-hidden="true" />
          Share evaluations
        </Button>
        {showSummary && sharedWith !== null && (
          <Button
            variant="link"
            className="h-auto p-0 text-[length:var(--text-sm)]"
            onClick={() => setOpen(true)}
          >
            {sharedWith === 0
              ? 'Not shared with anyone'
              : `Shared with ${sharedWith} ${sharedWith === 1 ? 'person' : 'people'}`}
          </Button>
        )}
      </div>

      <ShareEvaluationsDrawer
        candidateId={candidateId}
        candidateName={candidateName}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
