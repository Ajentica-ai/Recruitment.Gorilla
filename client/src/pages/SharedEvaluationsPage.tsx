import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ChevronLeft, Share2 } from 'lucide-react';
import EvaluationReportBody from '@/components/EvaluationReportBody';
import ReadOnlyCandidateProfile from '@/components/ReadOnlyCandidateProfile';
import EmptyState from '@/components/common/EmptyState';
import Page from '@/components/common/Page';
import PageHeader from '@/components/common/PageHeader';
import SectionCard from '@/components/common/SectionCard';
import LoadingPanel from '@/components/common/Loading';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/AuthContext';
import { getSharedProfile, getSharedReport, getSharedWithMe } from '@/services/api';
import { shareBannerText } from '@/lib/evaluationShares';
import type { SharedEvaluationSummary } from '@/types';

function scopeText(share: SharedEvaluationSummary): string {
  if (share.allRounds) return 'All rounds, including any added later.';
  const n = share.interviews.length;
  return `${n} ${n === 1 ? 'interview' : 'interviews'} shared.`;
}

/**
 * What was shared with the signed-in user: the candidate's submitted evaluations, the read-only
 * profile and CV. Open to every role, because access comes from an active grant (decided by the
 * server) and never from the user's role. A 404 therefore means "no active grant": it expired or was
 * revoked, which is said plainly rather than redirecting away.
 */
export default function SharedEvaluationsPage() {
  const { id } = useParams();
  const candidateId = Number(id);
  const { canWriteCandidates } = useAuth();

  const mine = useQuery({
    queryKey: ['shared-evaluations', 'mine'],
    queryFn: getSharedWithMe,
    retry: false,
  });
  const report = useQuery({
    queryKey: ['shared-evaluations', 'report', candidateId],
    queryFn: () => getSharedReport(candidateId),
    retry: false,
  });
  const share = mine.data?.find((s) => s.candidateId === candidateId);
  const profile = useQuery({
    queryKey: ['shared-evaluations', 'profile', candidateId],
    queryFn: () => getSharedProfile(candidateId),
    retry: false,
    enabled: share !== undefined,
  });

  if (mine.isLoading || report.isLoading) {
    return <LoadingPanel label="Loading shared evaluations…" />;
  }

  const reportNotFound = isAxiosError(report.error) && report.error.response?.status === 404;
  const back = (
    <Button asChild variant="outline">
      <Link to="/">Back to dashboard</Link>
    </Button>
  );

  if (report.error && !reportNotFound) {
    return (
      <EmptyState
        page
        variant="error"
        title="Failed to load the shared evaluations"
        description="The request failed. Refresh to try again."
        action={back}
      />
    );
  }

  // 404 with no active grant: it expired or was revoked.
  if (reportNotFound && !share) {
    return (
      <EmptyState
        page
        variant="empty"
        title="This share has expired or was revoked"
        description="Ask the person who shared it with you if you still need access."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {back}
            {canWriteCandidates && (
              <Button asChild variant="ghost">
                <Link to={`/candidates/${candidateId}/evaluations`}>Open the evaluation report</Link>
              </Button>
            )}
          </div>
        }
      />
    );
  }

  const banner = share && (
    <div className="alert-info-soft print:hidden" role="status" aria-label="About this share">
      <div className="flex items-center gap-2 font-medium">
        <Share2 size={14} strokeWidth={1.75} aria-hidden="true" />
        {shareBannerText(share)}
      </div>
      <p className="mb-0 text-[length:var(--text-sm)]">{scopeText(share)}</p>
      {share.note && <p className="mb-0 text-[length:var(--text-sm)]">Note: {share.note}</p>}
    </div>
  );

  return (
    <Page className="evaluation-report">
      <Link to="/" className="back-link print:hidden">
        <ChevronLeft size={14} strokeWidth={1.75} aria-hidden="true" />
        Back to dashboard
      </Link>

      <PageHeader
        title="Shared evaluations"
        description={
          report.data
            ? `${report.data.fullName}${report.data.roleApplied ? ` · ${report.data.roleApplied}` : ''}`
            : share?.candidateName
        }
      />

      {banner}

      {report.data ? (
        <EvaluationReportBody data={report.data} />
      ) : (
        <EmptyState
          variant="empty"
          title="Nothing to read yet"
          description="Evaluations for an interview you still have to evaluate stay hidden until you submit your own."
        />
      )}

      {profile.data && (
        <SectionCard title="Candidate profile" description="Read-only. Their CV opens from here too.">
          <ReadOnlyCandidateProfile candidate={profile.data} sharedCv />
        </SectionCard>
      )}
    </Page>
  );
}
