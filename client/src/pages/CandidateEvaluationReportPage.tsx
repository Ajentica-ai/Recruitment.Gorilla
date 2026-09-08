import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ChevronLeft, Printer } from 'lucide-react';

import EvaluationReportBody from '@/components/EvaluationReportBody';
import EmptyState from '@/components/common/EmptyState';
import Page from '@/components/common/Page';
import PageHeader from '@/components/common/PageHeader';
import LoadingPanel from '@/components/common/Loading';
import { Button } from '@/components/ui/button';
import { getCandidateEvaluationReport } from '@/services/api';

/**
 * The standalone evaluation report.
 *
 * The candidate detail page opens this same report in a drawer — a recruiter
 * reading it is almost always mid-review, and leaving the page loses the
 * profile and status history they were reading it against. This route stays
 * because a report is a thing people link to and print, and both of those
 * want a page of their own. Both render EvaluationReportBody, so there is one
 * implementation.
 */
export default function CandidateEvaluationReportPage() {
  const { id } = useParams();
  const candidateId = Number(id);

  const { data, isLoading, error } = useQuery({
    queryKey: ['evaluation-report', candidateId],
    queryFn: () => getCandidateEvaluationReport(candidateId),
    retry: false,
  });

  if (isLoading) {
    return <LoadingPanel label="Loading evaluation report…" />;
  }

  if (error || !data) {
    const notFound = isAxiosError(error) && error.response?.status === 404;
    return (
      <EmptyState
        page
        variant={notFound ? 'empty' : 'error'}
        title={notFound ? "This candidate's report isn't available to you" : 'Failed to load the report'}
        description={
          notFound
            ? 'Recruiters see reports only for candidates under a role they are assigned to.'
            : 'The request failed. Refresh to try again.'
        }
        action={
          <Button asChild variant="outline">
            <Link to="/candidates">Back to candidates</Link>
          </Button>
        }
      />
    );
  }

  return (
    <Page className="evaluation-report">
      <Link to={`/candidates/${candidateId}`} className="back-link print:hidden">
        <ChevronLeft size={14} strokeWidth={1.75} aria-hidden="true" />
        Back to candidate
      </Link>

      {/* A heading is right here: the topbar shows "Candidates", and this is a
          sub-page within it. */}
      <PageHeader
        title="Evaluation report"
        description={`${data.fullName}${data.roleApplied ? ` · ${data.roleApplied}` : ''}`}
        actions={
          <Button variant="outline" className="print:hidden" onClick={() => window.print()}>
            <Printer size={14} strokeWidth={1.75} aria-hidden="true" />
            Print
          </Button>
        }
      />

      <EvaluationReportBody data={data} />
    </Page>
  );
}
