import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PipelineStage = 'intake' | 'assessment' | 'interview' | 'offer' | 'hired';

interface StageDefinition {
  id: PipelineStage;
  label: string;
}

const STAGES: StageDefinition[] = [
  { id: 'intake', label: 'Intake' },
  { id: 'assessment', label: 'Assessment' },
  { id: 'interview', label: 'Interview' },
  { id: 'offer', label: 'Offer' },
  { id: 'hired', label: 'Hired' },
];

function resolveStage(status: string): { stage: PipelineStage; isRejected: boolean } {
  const s = status.toLowerCase();

  if (s.includes('reject') || s.includes('declined') || s.includes('discontinued') || s.includes('not recommended')) {
    return { stage: 'hired', isRejected: true };
  }
  if (s.includes('hired') || s.includes('offer accepted')) {
    return { stage: 'hired', isRejected: false };
  }
  if (s.includes('offer') || s.includes('recommended')) {
    return { stage: 'offer', isRejected: false };
  }
  if (s.includes('interview')) {
    return { stage: 'interview', isRejected: false };
  }
  if (s.includes('assessment') || s.includes('submission') || s.includes('code review')) {
    return { stage: 'assessment', isRejected: false };
  }
  return { stage: 'intake', isRejected: false };
}

const STAGE_ORDER: Record<PipelineStage, number> = {
  intake: 0,
  assessment: 1,
  interview: 2,
  offer: 3,
  hired: 4,
};

export default function CandidatePipelineStepper({
  currentStatus,
  className,
}: {
  currentStatus: string;
  className?: string;
}) {
  const { stage: activeStage, isRejected } = resolveStage(currentStatus);
  const activeIndex = STAGE_ORDER[activeStage];

  return (
    <div
      className={cn(
        'flex w-full items-center overflow-x-auto rounded-lg border border-border/70 bg-surface-muted/40 p-1.5 sm:p-2',
        className,
      )}
      role="navigation"
      aria-label="Candidate hiring pipeline stage"
    >
      <ol className="flex w-full items-center justify-between gap-1 min-w-[32rem]">
        {STAGES.map((s, idx) => {
          const isCurrent = idx === activeIndex;
          const isPassed = idx < activeIndex;
          const isLastAndRejected = isCurrent && isRejected;

          return (
            <li
              key={s.id}
              className={cn(
                'flex flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-[length:var(--text-xs)] font-medium transition-all',
                isCurrent && !isRejected && 'bg-primary/10 text-primary font-semibold border border-primary/25 shadow-2xs',
                isLastAndRejected && 'bg-destructive/10 text-destructive font-semibold border border-destructive/25',
                isPassed && 'text-text-soft',
                !isPassed && !isCurrent && 'text-muted-foreground opacity-65',
              )}
            >
              <div
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                  isPassed && 'bg-primary text-white',
                  isCurrent && !isRejected && 'bg-primary text-white ring-2 ring-primary/30',
                  isLastAndRejected && 'bg-destructive text-white ring-2 ring-destructive/30',
                  !isPassed && !isCurrent && 'border border-border bg-surface text-muted-foreground',
                )}
              >
                {isPassed ? (
                  <Check size={11} strokeWidth={3} />
                ) : isLastAndRejected ? (
                  <X size={11} strokeWidth={3} />
                ) : (
                  idx + 1
                )}
              </div>
              <span className="truncate">
                {isLastAndRejected ? 'Rejected / Closed' : s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
