import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Share2 } from 'lucide-react';
import { getSharedWithMe } from '../../services/api';
import SectionCard from '../common/SectionCard';
import Avatar from '../common/Avatar';
import { Badge } from '@/components/ui/badge';
import { formatShareDate } from '@/lib/evaluationShares';
import type { SharedEvaluationSummary } from '../../types';

function meta(share: SharedEvaluationSummary): string {
  return [
    share.roleApplied,
    share.grantedByName ? `by ${share.grantedByName}` : null,
    share.expiresAt ? `until ${formatShareDate(share.expiresAt)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Candidates whose evaluations someone shared with the signed-in user (#186), for every role. It is
 * the way in for an Interviewer-only user, who has no candidate list. Nothing is rendered while it
 * loads, when it fails or when nothing is shared: a card that says "nothing here" to most people
 * would be noise, and the notification link and the interview page still lead to the same place.
 */
export default function SharedWithMeCard() {
  const { data } = useQuery({
    queryKey: ['shared-evaluations', 'mine'],
    queryFn: getSharedWithMe,
    retry: false,
  });

  if (!data || data.length === 0) return null;

  return (
    <SectionCard
      title="Shared with me"
      description="Evaluations other people shared with you."
      actions={
        <Badge variant="neutral">
          <Share2 size={12} strokeWidth={1.75} aria-hidden="true" />
          {data.length}
        </Badge>
      }
    >
      <ul className="flex flex-col gap-1" aria-label="Candidates shared with you">
        {data.map((share) => (
          <li key={share.candidateId}>
            <Link
              to={`/shared/candidates/${share.candidateId}/evaluations`}
              className="flex items-center gap-3 rounded-[var(--radius-md)] p-2 text-foreground no-underline hover:bg-muted hover:no-underline"
            >
              <Avatar name={share.candidateName} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{share.candidateName}</span>
                <span className="truncate text-[length:var(--text-sm)] text-muted-foreground">
                  {meta(share) || 'Shared with you'}
                </span>
              </span>
              <Badge variant={share.visibleEvaluationCount > 0 ? 'brand' : 'neutral'}>
                {share.visibleEvaluationCount}{' '}
                {share.visibleEvaluationCount === 1 ? 'evaluation' : 'evaluations'}
              </Badge>
              <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" className="text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
