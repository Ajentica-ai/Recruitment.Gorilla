import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ExternalLink, Printer } from 'lucide-react';

import EvaluationReportBody from '@/components/EvaluationReportBody';
import EmptyState from '@/components/common/EmptyState';
import LoadingPanel from '@/components/common/Loading';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { getCandidateEvaluationReport } from '@/services/api';

/**
 * The evaluation report as a drawer over the candidate.
 *
 * Reading a report is a step inside reviewing a candidate, not a destination:
 * you check the scores against the CV, the status history and the notes that
 * are already on screen. Navigating to a separate page threw all of that away
 * and made "back" the most-used control on the report.
 *
 * The standalone route stays for the two things a drawer genuinely cannot do
 * — being linked to, and being printed — and the footer offers both.
 *
 * The query is keyed identically to the page's, so opening the drawer after
 * visiting the page (or the reverse) is served from cache.
 */
export default function EvaluationReportDrawer({
  candidateId,
  candidateName,
  role,
  open,
  onOpenChange,
}: {
  candidateId: number;
  candidateName: string;
  role?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['evaluation-report', candidateId],
    queryFn: () => getCandidateEvaluationReport(candidateId),
    retry: false,
    // Nothing is fetched until the drawer is actually opened.
    enabled: open,
  });

  const notFound = isAxiosError(error) && error.response?.status === 404;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(52rem,100vw)]">
        <SheetHeader>
          <SheetTitle>Evaluation report</SheetTitle>
          <SheetDescription>
            {candidateName}
            {role ? ` · ${role}` : ''}
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          {isLoading ? (
            <LoadingPanel label="Loading evaluation report…" />
          ) : error || !data ? (
            <EmptyState
              variant={notFound ? 'empty' : 'error'}
              title={notFound ? 'Not available to you' : 'Failed to load the report'}
              description={
                notFound
                  ? 'Recruiters see reports only for candidates under a role they are assigned to.'
                  : 'The request failed. Close and reopen to try again.'
              }
            />
          ) : (
            <EvaluationReportBody data={data} dense />
          )}
        </SheetBody>

        <SheetFooter>
          <Button asChild variant="ghost">
            <Link to={`/candidates/${candidateId}/evaluations`}>
              <ExternalLink strokeWidth={1.75} aria-hidden="true" />
              Open as a page
            </Link>
          </Button>
          <Button variant="outline" onClick={() => window.print()} disabled={!data}>
            <Printer strokeWidth={1.75} aria-hidden="true" />
            Print
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
