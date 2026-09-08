import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Layers, Users } from 'lucide-react';
import KanbanColumn from './KanbanColumn';
import KanbanMinimap from './KanbanMinimap';
import AddStatusModal from '../AddStatusModal';
import { useToast } from '../ToastStack';
import { addStatus, getNextStatusOptions, getStatusOptions } from '../../services/api';
import { isStageStagnant } from '../../utils/stagnantStage';
import { Spinner } from '@/components/ui/spinner';
import type { CandidateListItem, StatusOption } from '../../types';

export interface KanbanBoardProps {
  candidates: CandidateListItem[];
  isLoading: boolean;
  canWrite: boolean;
}

// Stages that strictly require extra inputs/forms before moving
const STAGES_REQUIRING_MODAL = new Set([
  'Technical Assessment',
  'Submission Received',
  'Submission Receieved',
  'Interview Scheduled',
  'Interview Completed',
  'Reject',
  'Discontinued',
]);

export default function KanbanBoard({ candidates, isLoading, canWrite }: KanbanBoardProps) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [activeModalCandidate, setActiveModalCandidate] = useState<{
    id: number;
    name: string;
    targetStatus?: string;
  } | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);

  const { data: statusOptions = [] } = useQuery({
    queryKey: ['status-options', 'active'],
    queryFn: getStatusOptions,
  });

  // Group candidates by current status
  const candidatesByStatus = useMemo(() => {
    const map = new Map<string, CandidateListItem[]>();
    for (const opt of statusOptions) {
      map.set(opt.name, []);
    }
    for (const c of candidates) {
      const list = map.get(c.currentStatus);
      if (list) {
        list.push(c);
      } else {
        // Fallback for custom or unmapped status
        map.set(c.currentStatus, [c]);
      }
    }
    return map;
  }, [statusOptions, candidates]);

  // Bottleneck & Stagnant count
  const stagnantCount = useMemo(() => {
    return candidates.filter((c) =>
      isStageStagnant(c.updatedAt || c.createdAt, c.currentStatus),
    ).length;
  }, [candidates]);

  // Direct status transition mutation for simple stages
  const directTransitionMutation = useMutation({
    mutationFn: ({ candidateId, targetStatus }: { candidateId: number; targetStatus: string }) =>
      addStatus(candidateId, {
        status: targetStatus,
        comment: null,
        taskDetails: null,
        submissionUrl: null,
        interviewAt: null,
      }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['candidates'] });
      void queryClient.invalidateQueries({ queryKey: ['candidate', variables.candidateId] });
      void queryClient.invalidateQueries({ queryKey: ['status-options'] });
      void queryClient.invalidateQueries({ queryKey: ['my-interviews'] });
      addToast(`Candidate moved to '${variables.targetStatus}'.`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Status transition failed. Check stage prerequisites.';
      addToast(msg, 'danger');
    },
  });

  const handleAdvanceClick = (candidate: CandidateListItem) => {
    setActiveModalCandidate({ id: candidate.id, name: candidate.fullName });
  };

  const handleDropCandidate = async (candidateId: number, targetStatus: string) => {
    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate) return;

    if (candidate.currentStatus === targetStatus) {
      return; // Dropped on same column
    }

    // Check if target stage requires a modal with prerequisites
    if (STAGES_REQUIRING_MODAL.has(targetStatus)) {
      setActiveModalCandidate({
        id: candidate.id,
        name: candidate.fullName,
        targetStatus,
      });
      return;
    }

    // For other stages, check valid next statuses from API or trigger transition
    try {
      const allowedNext = await getNextStatusOptions(candidate.id);
      const isAllowed = allowedNext.some((o) => o.name === targetStatus);

      if (!isAllowed) {
        addToast(
          `Cannot move directly from '${candidate.currentStatus}' to '${targetStatus}'. Allowed next: ${allowedNext.map((o) => o.name).join(', ') || 'None'}`,
          'warning',
        );
        return;
      }

      directTransitionMutation.mutate({ candidateId: candidate.id, targetStatus });
    } catch {
      // If check fails, open modal for manual review
      setActiveModalCandidate({
        id: candidate.id,
        name: candidate.fullName,
        targetStatus,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="kanban-loading flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Spinner className="text-brand" label="Loading board" />
        Loading recruitment pipeline board…
      </div>
    );
  }

  return (
    <div className="kanban-wrapper">
      {/* Board Summary & Bottleneck Alert Bar */}
      <div className="kanban-summary-bar">
        <div className="flex items-center gap-6 flex-wrap">
          <span className="kanban-summary-item">
            <Users size={14} className="text-brand mr-2 shrink-0" />
            <span>
              <strong>{candidates.length}</strong> Total Candidates
            </span>
          </span>
          <span className="kanban-summary-item">
            <Layers size={14} className="text-text-soft mr-2 shrink-0" />
            <span>
              <strong>{statusOptions.length}</strong> Stages
            </span>
          </span>
          {stagnantCount > 0 && (
            <span className="kanban-bottleneck-alert">
              <AlertTriangle size={14} className="mr-2 shrink-0" />
              <span>
                <strong>{stagnantCount}</strong> candidates stagnant (&gt; 5 days in stage)
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Horizontal Scrolling Board Columns */}
      <div className="kanban-board" ref={boardRef}>
        {statusOptions.map((opt: StatusOption) => (
          <KanbanColumn
            key={opt.id}
            statusOption={opt}
            candidates={candidatesByStatus.get(opt.name) || []}
            onAdvanceCandidate={handleAdvanceClick}
            onDropCandidate={handleDropCandidate}
            canWrite={canWrite}
          />
        ))}
      </div>

      {/* Floating Minimap / Viewport Navigator (Atlassian / Jira style) */}
      <KanbanMinimap statusOptions={statusOptions} boardRef={boardRef} />

      {/* Shared Prerequisite & Status Advancement Dialog */}
      {activeModalCandidate && (
        <AddStatusModal
          candidateId={activeModalCandidate.id}
          candidateName={activeModalCandidate.name}
          initialStatus={activeModalCandidate.targetStatus}
          show={!!activeModalCandidate}
          onHide={() => setActiveModalCandidate(null)}
          onAdded={() => {
            setActiveModalCandidate(null);
            void queryClient.invalidateQueries({ queryKey: ['candidates'] });
          }}
        />
      )}
    </div>
  );
}
