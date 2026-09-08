import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { FileText, StickyNote } from 'lucide-react';
import { getInterview, getInterviewEvaluationRubric } from '../services/api';
import ReadOnlyCandidateProfile from '../components/ReadOnlyCandidateProfile';
import EvaluationForm, { EvaluationReadOnly } from '../components/EvaluationForm';
import { skillColorClass } from '../utils/skillColors';
import EmptyState from '../components/common/EmptyState';
import Page from '../components/common/Page';
import LoadingPanel from '../components/common/Loading';
import { initials } from '../utils/initials';
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

/** Relative label for the scheduled date: Today / Tomorrow / In N days / Completed. */
const relativeLabel = (scheduledAt: string): { label: string; soon: boolean } => {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date(scheduledAt)) - startOfDay(new Date())) / 86_400_000);
  if (days < 0) return { label: 'Completed', soon: false };
  if (days === 0) return { label: 'Today', soon: true };
  if (days === 1) return { label: 'Tomorrow', soon: true };
  return { label: `In ${days} days`, soon: false };
};

export default function InterviewPage() {
  const { id } = useParams();
  const interviewId = Number(id);

  const { data, isLoading, error } = useQuery({
    queryKey: ['interview', interviewId],
    queryFn: () => getInterview(interviewId),
    retry: false,
  });

  const { data: rubric } = useQuery({
    queryKey: ['interview-rubric', interviewId],
    queryFn: () => getInterviewEvaluationRubric(interviewId),
    enabled: !!data,
  });

  /* Declared before the early returns below. A hook placed after them runs on
     some renders and not others, which desynchronises React's hook order the
     first time the query resolves. */
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);

  if (isLoading) {
    return <LoadingPanel label="Loading interview…" />;
  }

  if (error || !data) {
    const notFound = isAxiosError(error) && error.response?.status === 404;
    return (
      <EmptyState
        page
        // Not an error: being unassigned is a correct, expected outcome, and
        // painting it red would read as "something went wrong".
        variant={notFound ? 'empty' : 'error'}
        title={notFound ? "This interview isn't available to you" : 'Failed to load the interview'}
        description={
          notFound
            ? 'You see an interview only when you are one of its assigned interviewers, or an Admin.'
            : 'The request failed. Refresh the page to try again.'
        }
        action={
          <Button asChild variant="outline">
            <Link to="/">Back to dashboard</Link>
          </Button>
        }
      />
    );
  }

  // timeZoneName: interviews can span timezones, so the zone is shown rather than implied.
  const scheduled = new Date(data.scheduledAt).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZoneName: 'short',
  });
  const relative = relativeLabel(data.scheduledAt);
  const role = data.candidate.roleApplied ?? data.candidate.appliedRole;
  const otherEvaluations = (data.allEvaluations ?? []).filter(
    (e) => e.interviewerUserId !== data.myEvaluation?.interviewerUserId
  );

  /** The recruiter's brief, rendered inside whichever card leads the column. */
  const briefing = data.notes ? (
    <div className="eval-briefing">
      <div className="eval-briefing__label">
        <StickyNote size={13} strokeWidth={1.75} aria-hidden="true" />
        Notes from the recruiter
      </div>
      <div className="eval-briefing__body">{data.notes}</div>
    </div>
  ) : null;

  return (
    <Page>
      <div className="interview-hero anim-fade-up">
        <div className="interview-hero__top">
          <div className="profile-avatar">{initials(data.candidate.fullName) || '?'}</div>
          <div className="interview-hero__identity">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="mb-0">{data.candidate.fullName}</h2>
              {role && <span className="badge bg-primary-subtle text-brand font-medium px-2 py-1 rounded-full">{role}</span>}
              {data.interviewTags.map((tag) => (
                <span key={tag} className={skillColorClass(tag)}>{tag}</span>
              ))}
            </div>
            <div className="interview-hero__meta text-muted-foreground text-[length:var(--text-sm)] mt-1">
              <span>{data.candidate.email}</span>
              {data.candidate.currentTitle && <span>• {data.candidate.currentTitle}</span>}
            </div>
          </div>

          <div className="interview-hero__aside">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`interview-chip${relative.soon ? ' interview-chip--soon' : ''}`}>
                <CalendarIcon /> {scheduled} · {data.durationMinutes} min · {relative.label}
              </span>

              {/* View Full Candidate Profile Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowProfileDrawer(true)}
                title="View full candidate CV, education, experience and details"
              >
                <FileText strokeWidth={2} aria-hidden="true" />
                View Profile &amp; CV
              </Button>
            </div>

            <div className="interview-hero__people mt-1">
              <span className="field-label interview-hero__people-label">
                {data.interviewers.length === 1 ? 'Interviewer' : 'Interviewers'}:
              </span>
              {data.interviewers.map((i) => (
                <span key={i.userId} className="interviewer-pill" title={i.name}>
                  <span className="interviewer-pill__avatar">{initials(i.name) || '?'}</span>
                  {i.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Full-Width Evaluation Studio */}
      <div className="interview-studio-container anim-fade-up" style={{ animationDelay: '60ms' }}>
        {data.canEvaluate ? (
          <EvaluationForm
            interviewId={interviewId}
            evaluation={data.myEvaluation}
            briefing={briefing}
          />
        ) : (
          <div className="pulse-card">
            {briefing}
            <div className="alert-info-soft">
              You are viewing this interview but are not an assigned interviewer.
            </div>
          </div>
        )}

        {data.allEvaluations && otherEvaluations.length > 0 && (
          <div className="mt-6">
            <Accordion type="single" collapsible>
              <AccordionItem value="others">
                <AccordionTrigger>Other interviewers' evaluations ({otherEvaluations.length})</AccordionTrigger>
                <AccordionContent>
                  <div className="card-stack">
                    {otherEvaluations.map((e) => (
                      <div key={e.id}>
                        <div className="flex justify-between items-center gap-2 mb-2">
                          <strong>{e.interviewerName}</strong>
                          <Badge variant={e.isSubmitted ? 'success' : 'neutral'}>
                            {e.isSubmitted ? 'Submitted' : 'Draft'}
                          </Badge>
                        </div>
                        <EvaluationReadOnly evaluation={e} rubric={rubric} />
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </div>

      {/* Slide-over Candidate Profile & CV Drawer */}
      <Sheet open={showProfileDrawer} onOpenChange={setShowProfileDrawer}>
        <SheetContent side="right" className="w-[min(35rem,100vw)]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-semibold">
            <FileText size={18} className="text-brand" />
            <span>Candidate Profile & Qualifications</span>
          </SheetTitle>
        </SheetHeader>
        <SheetBody className="p-4">
          <ReadOnlyCandidateProfile candidate={data.candidate} />
        </SheetBody>
      </SheetContent>
</Sheet>
    </Page>
  );
}
