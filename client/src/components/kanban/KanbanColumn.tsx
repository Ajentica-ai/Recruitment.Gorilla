import React, { useState } from 'react';
import KanbanCard from './KanbanCard';
import { StatusDot } from '../StatusBadge';
import { calculateAverageStageAge } from '../../utils/stagnantStage';
import type { CandidateListItem, StatusOption } from '../../types';

export interface KanbanColumnProps {
  statusOption: StatusOption;
  candidates: CandidateListItem[];
  onAdvanceCandidate: (candidate: CandidateListItem) => void;
  onDropCandidate: (candidateId: number, targetStatus: string) => void;
  canWrite: boolean;
}

export default function KanbanColumn({
  statusOption,
  candidates,
  onAdvanceCandidate,
  onDropCandidate,
  canWrite,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const avgDays = calculateAverageStageAge(candidates.map((c) => c.updatedAt || c.createdAt));

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!canWrite) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only remove highlight if we actually left the column element
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!canWrite) return;

    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      if (data && data.candidateId) {
        onDropCandidate(Number(data.candidateId), statusOption.name);
      }
    } catch {
      // Ignored malformed drag payload
    }
  };

  return (
    <div
      className={`kanban-column ${isDragOver ? 'kanban-column--drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-status-name={statusOption.name}
    >
      <div className="kanban-column__header">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={statusOption.name} />
          <span className="kanban-column__title truncate" title={statusOption.name}>
            {statusOption.name}
          </span>
          <span className="kanban-column__count">{candidates.length}</span>
        </div>
        {candidates.length > 0 && avgDays > 0 && (
          <span className="kanban-column__avg" title="Average days in this stage">
            Avg {avgDays}d
          </span>
        )}
      </div>

      <div className="kanban-column__cards">
        {candidates.length === 0 ? (
          <div className="kanban-column__empty">No candidates</div>
        ) : (
          candidates.map((candidate) => (
            <KanbanCard
              key={candidate.id}
              candidate={candidate}
              onAdvanceClick={onAdvanceCandidate}
              canWrite={canWrite}
            />
          ))
        )}
      </div>
    </div>
  );
}
