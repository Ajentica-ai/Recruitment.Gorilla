import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight } from 'lucide-react';

import Avatar from '@/components/common/Avatar';
import { calculateDaysInStage, formatStageAge, isStageStagnant } from '@/utils/stagnantStage';
import { cn } from '@/lib/utils';
import type { CandidateListItem } from '@/types';

export interface KanbanCardProps {
  candidate: CandidateListItem;
  onAdvanceClick: (candidate: CandidateListItem) => void;
  canWrite: boolean;
}

/**
 * A card on the pipeline board.
 *
 * Compact on purpose. The version this replaces stacked four rows — a name
 * row, a role row, a source row and a footer carrying a time badge and a full
 * "Advance" button — which made a card 100px tall and fitted four per column
 * on a laptop. A board's whole value is seeing the shape of the pipeline at
 * once, and it cannot do that if each column shows four of eleven cards.
 *
 * So: identity and role share the avatar's two lines, the metadata is one
 * muted line, and the advance control appears on hover. It is still keyboard
 * reachable — `focus-within` reveals it too — but it is not painted 40 times
 * on a board where the primary interaction is dragging.
 */
export default function KanbanCard({ candidate, onAdvanceClick, canWrite }: KanbanCardProps) {
  const stageDate = candidate.updatedAt || candidate.createdAt;
  const daysInStage = calculateDaysInStage(stageDate);
  const isStagnant = isStageStagnant(stageDate, candidate.currentStatus);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData(
      'text/plain',
      JSON.stringify({ candidateId: candidate.id, currentStatus: candidate.currentStatus }),
    );
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('kanban-card--dragging');
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('kanban-card--dragging');
  };

  const meta = [candidate.appliedRole, candidate.source, candidate.batchName].filter(Boolean).join(' · ');

  return (
    <div
      className={cn('kanban-card group', isStagnant && 'kanban-card--stagnant')}
      draggable={canWrite}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      data-candidate-id={candidate.id}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Avatar name={candidate.fullName} email={candidate.email} size="sm" className="mt-px" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Link
            to={`/candidates/${candidate.id}`}
            className="kanban-card__name truncate"
            title={candidate.fullName}
          >
            {candidate.fullName}
          </Link>
          {meta && (
            <span className="truncate text-[length:var(--text-xs)] text-muted-foreground" title={meta}>
              {meta}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        {isStagnant ? (
          <span
            className="kanban-badge kanban-badge--stagnant"
            title={`Bottleneck: ${daysInStage} days in ${candidate.currentStatus} (over 5 business days)`}
          >
            <AlertTriangle size={11} className="shrink-0" aria-hidden="true" />
            {formatStageAge(daysInStage)} Stagnant
          </span>
        ) : (
          <span
            className="text-[length:var(--text-2xs)] text-muted-foreground tabular-nums"
            title={`Time in stage: ${formatStageAge(daysInStage)}`}
          >
            {formatStageAge(daysInStage)} in stage
          </span>
        )}

        {canWrite && (
          <button
            type="button"
            className={cn(
              'inline-flex shrink-0 items-center gap-0.5 rounded-[var(--radius-sm)] px-1.5 py-0.5',
              'text-[length:var(--text-2xs)] font-semibold text-brand',
              'opacity-0 transition-opacity duration-[var(--dur-fast)]',
              'group-hover:opacity-100 focus-visible:opacity-100',
              'hover:bg-brand-muted',
              'focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] outline-none',
            )}
            title="Advance candidate to the next stage"
            onClick={() => onAdvanceClick(candidate)}
          >
            Advance
            <ChevronRight size={12} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
