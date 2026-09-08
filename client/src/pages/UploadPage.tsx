import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UploadCloud, Layers, CheckCircle2, ArrowRight } from 'lucide-react';
import BulkUploader from '../components/BulkUploader';
import DraftReviewWorkspace from '../components/drafts/DraftReviewWorkspace';
import { Button } from '@/components/ui/button';
import Page from '../components/common/Page';
import SectionCard from '../components/common/SectionCard';
import { getCandidateDrafts } from '../services/api';
import type { CVDraft } from '../types';

export default function UploadPage() {
  const [activeTab, setActiveTab] = useState<'upload' | 'review'>('upload');
  const [lastUploadedBatchId, setLastUploadedBatchId] = useState<string | null>(null);
  const [lastBatchCount, setLastBatchCount] = useState<number>(0);

  // Fetch pending drafts count for tab pill
  const { data: draftsSummary, refetch: refetchDrafts } = useQuery({
    queryKey: ['candidate-drafts', 'Pending', '', undefined, ''],
    queryFn: () => getCandidateDrafts({ status: 'Pending', pageSize: 1 }),
  });

  const pendingCount = draftsSummary?.totalPending ?? 0;

  const handleParsed = (drafts: CVDraft[], batchId?: string) => {
    if (batchId) setLastUploadedBatchId(batchId);
    setLastBatchCount(drafts.length);
    void refetchDrafts();
  };

  return (
    <Page>
      {/* Workspace Sub-Nav Tab Bar */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="segmented">
          <button
            type="button"
            className={`segmented__item ${activeTab === 'upload' ? 'segmented__item--active active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <UploadCloud size={15} className="me-1.5 shrink-0" />
            <span>Upload &amp; Intake</span>
          </button>
          <button
            type="button"
            className={`segmented__item ${activeTab === 'review' ? 'segmented__item--active active' : ''}`}
            onClick={() => setActiveTab('review')}
          >
            <Layers size={15} className="me-1.5 shrink-0" />
            <span className="hidden sm:inline">Review Staging Workspace</span>
            <span className="sm:hidden">Review Workspace</span>
            {pendingCount > 0 && (
              <span className="draft-badge--pending ml-1.5 sm:ml-2">
                <span className="hidden sm:inline">{pendingCount} Pending</span>
                <span className="sm:hidden">{pendingCount}</span>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab 1: Upload & Intake */}
      {activeTab === 'upload' && (
        <div className="page-stack">
          <SectionCard title="Bulk CV Upload &amp; Document Intake">
            <BulkUploader onDraftsParsed={handleParsed} />
          </SectionCard>

          {/* Staging Handoff Banner */}
          {lastBatchCount > 0 && (
            <div className="alert-success-soft flex flex-wrap items-center justify-between gap-4" role="status">
              <div className="inline-flex items-center gap-2.5">
                <CheckCircle2 size={20} className="text-success-foreground shrink-0" />
                <div>
                  <div className="font-semibold">
                    Successfully staged {lastBatchCount} resume{lastBatchCount === 1 ? '' : 's'} to database!
                  </div>
                  <div className="text-muted-foreground text-[length:var(--text-sm)]">
                    All candidates have been saved as pending drafts. You can review them now or come back anytime.
                  </div>
                </div>
              </div>
              <Button size="sm" onClick={() => setActiveTab('review')}>
                Open Review Workspace
                <ArrowRight />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Staging & Review Studio Workspace */}
      {activeTab === 'review' && (
        <DraftReviewWorkspace
          initialBatchId={lastUploadedBatchId}
          onCandidateCreated={() => {
            void refetchDrafts();
          }}
        />
      )}
    </Page>
  );
}
