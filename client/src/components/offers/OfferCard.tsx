import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, DollarSign, Download, Edit3, FileText, Plus, Send, XCircle } from 'lucide-react';
import { useToast } from '../ToastStack';
import { useAuth } from '../../auth/AuthContext';
import {
  downloadOfferPdf,
  extendOffer,
  getCandidateOffers,
  reviewOfferApproval,
  submitOfferForApproval,
} from '../../services/api';
import type { CandidateDetail, Offer } from '../../types';
import CreateOfferModal from './CreateOfferModal';
import OfferDecisionModal from './OfferDecisionModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';

interface OfferCardProps {
  candidate: CandidateDetail;
}

export default function OfferCard({ candidate }: OfferCardProps) {
  const { isAdminOrAbove } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [activeDecisionOffer, setActiveDecisionOffer] = useState<Offer | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ['candidate-offers', candidate.id],
    queryFn: () => getCandidateOffers(candidate.id),
  });

  const latestOffer = offers.length > 0 ? offers[0] : null;

  const submitApprovalMutation = useMutation({
    mutationFn: (offerId: number) => submitOfferForApproval(candidate.id, offerId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['candidate-offers', candidate.id] });
      addToast('Offer submitted for approval', 'info');
    },
    onError: () => addToast('Failed to submit offer for approval', 'danger'),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ offerId, decision }: { offerId: number; decision: 'Approved' | 'Rejected' }) =>
      reviewOfferApproval(candidate.id, offerId, { decision }),
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['candidate-offers', candidate.id] });
      addToast(`Offer ${vars.decision.toLowerCase()}`, vars.decision === 'Approved' ? 'success' : 'info');
    },
    onError: () => addToast('Failed to record approval decision', 'danger'),
  });

  const extendMutation = useMutation({
    mutationFn: (offerId: number) => extendOffer(candidate.id, offerId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['candidate-offers', candidate.id] });
      void queryClient.invalidateQueries({ queryKey: ['candidate', candidate.id] });
      void queryClient.invalidateQueries({ queryKey: ['candidates'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      addToast('Offer marked as Extended to candidate!', 'success');
    },
    onError: () => addToast('Failed to extend offer', 'danger'),
  });

  const handleDownloadPdf = async (offer: Offer) => {
    try {
      setIsDownloadingPdf(true);
      const blob = await downloadOfferPdf(candidate.id, offer.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Offer_Letter_${candidate.fullName.replace(/\s+/g, '_')}_#${offer.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      addToast('Offer letter PDF downloaded', 'success');
    } catch {
      addToast('Failed to generate offer letter PDF', 'danger');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Accepted':
        return 'success';
      case 'Extended':
        return 'brand';
      case 'PendingApproval':
        return 'warning';
      case 'Declined':
      case 'Withdrawn':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  if (isLoading) {
    return (
      <div className="offer-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-[length:var(--text-sm)]">
          <Spinner /> Loading compensation details...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="offer-card">
        <div className="offer-card__header">
          <div className="flex items-center gap-2">
            <DollarSign size={17} className="text-brand" />
            <span className="font-semibold text-[length:var(--text-sm)]">Offer & Compensation</span>
            {latestOffer && (
              <Badge variant={getStatusBadgeVariant(latestOffer.status)} className="ml-1 font-normal">
                {latestOffer.status}
              </Badge>
            )}
          </div>
          {candidate.currentStatus !== 'Hired' && (
            <div className="flex gap-1">
              {latestOffer ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1 py-1 px-2.5"
                  onClick={() => {
                    setEditingOffer(null);
                    setShowCreateModal(true);
                  }}
                >
                  <Plus size={14} /> New Version
                </Button>
              ) : (
                <Button
 
                  size="sm"
                  className="flex items-center gap-1 py-1 px-2.5"
                  onClick={() => {
                    setEditingOffer(null);
                    setShowCreateModal(true);
                  }}
                >
                  <Plus size={14} /> Draft Offer
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="p-4">
          {!latestOffer ? (
            <div className="text-center py-4 text-muted-foreground text-[length:var(--text-sm)]">
              <FileText size={28} className="mb-2 opacity-50 block mx-auto text-text-soft" />
              No employment offer drafted yet for this candidate.
            </div>
          ) : (
            <div>
              <div className="offer-hero">
                <div>
                  <div className="offer-hero__title">{latestOffer.jobTitle}</div>
                  <span className="text-muted-foreground text-[length:var(--text-sm)]">Created by {latestOffer.createdByName || 'Recruiter'}</span>
                </div>
                <div className="text-right">
                  <div className="offer-hero__salary">
                    {latestOffer.currency} {latestOffer.baseSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-muted-foreground text-[length:var(--text-sm)]">/ year (gross)</span>
                </div>
              </div>

              <div className="offer-meta-grid">
                {latestOffer.bonus && latestOffer.bonus > 0 ? (
                  <div className="offer-meta-tile">
                    <div className="offer-meta-tile__label">Bonus / Incentive</div>
                    <div className="offer-meta-tile__value">
                      {latestOffer.currency} {latestOffer.bonus.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ) : null}

                {latestOffer.equity ? (
                  <div className="offer-meta-tile">
                    <div className="offer-meta-tile__label">Equity / Options</div>
                    <div className="offer-meta-tile__value" title={latestOffer.equity}>
                      {latestOffer.equity}
                    </div>
                  </div>
                ) : null}

                {latestOffer.startDate ? (
                  <div className="offer-meta-tile">
                    <div className="offer-meta-tile__label">Proposed Start</div>
                    <div className="offer-meta-tile__value">
                      {new Date(latestOffer.startDate).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                ) : null}

                {latestOffer.expirationDate ? (
                  <div className="offer-meta-tile">
                    <div className="offer-meta-tile__label">Valid Until</div>
                    <div className="offer-meta-tile__value">
                      {new Date(latestOffer.expirationDate).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              {latestOffer.notes && (
                <div className="offer-notes-callout">
                  {latestOffer.notes}
                </div>
              )}

              {latestOffer.status === 'Declined' && latestOffer.declineReason && (
                <div className="alert alert-danger py-2 text-[length:var(--text-sm)] mb-4">
                  <strong>Decline Reason:</strong> {latestOffer.declineReason}
                </div>
              )}

              {/* Action Toolbar */}
              <div className="offer-toolbar">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1.5"
                  disabled={isDownloadingPdf}
                  onClick={() => handleDownloadPdf(latestOffer)}
                >
                  {isDownloadingPdf ? <Spinner /> : <Download size={14} />}
                  Download PDF
                </Button>

                {latestOffer.status === 'Draft' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1.5"
                      onClick={() => {
                        setEditingOffer(latestOffer);
                        setShowCreateModal(true);
                      }}
                    >
                      <Edit3 size={14} /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1.5"
                      disabled={submitApprovalMutation.isPending}
                      onClick={() => submitApprovalMutation.mutate(latestOffer.id)}
                    >
                      <Send size={14} /> Request Approval
                    </Button>
                    <Button
 
                      size="sm"
                      className="flex items-center gap-1.5"
                      disabled={extendMutation.isPending}
                      onClick={() => extendMutation.mutate(latestOffer.id)}
                    >
                      <CheckCircle2 size={14} /> Extend Offer
                    </Button>
                  </>
                )}

                {latestOffer.status === 'PendingApproval' && isAdminOrAbove && (
                  <>
                    <Button
                      variant="outlineDestructive"
                      size="sm"
                      className="flex items-center gap-1.5"
                      disabled={reviewMutation.isPending}
                      onClick={() => reviewMutation.mutate({ offerId: latestOffer.id, decision: 'Rejected' })}
                    >
                      <XCircle size={14} /> Reject
                    </Button>
                    <Button
                      
                      size="sm"
                      className="flex items-center gap-1.5"
                      disabled={reviewMutation.isPending}
                      onClick={() => reviewMutation.mutate({ offerId: latestOffer.id, decision: 'Approved' })}
                    >
                      <CheckCircle2 size={14} /> Approve Offer
                    </Button>
                  </>
                )}

                {latestOffer.status === 'Approved' && (
                  <Button
 
                    size="sm"
                    className="flex items-center gap-1.5"
                    disabled={extendMutation.isPending}
                    onClick={() => extendMutation.mutate(latestOffer.id)}
                  >
                    <CheckCircle2 size={14} /> Extend Offer to Candidate
                  </Button>
                )}

                {latestOffer.status === 'Extended' && (
                  <Button
 
                    size="sm"
                    className="flex items-center gap-1.5"
                    onClick={() => {
                      setActiveDecisionOffer(latestOffer);
                      setShowDecisionModal(true);
                    }}
                  >
                    <CheckCircle2 size={14} /> Record Candidate Decision
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateOfferModal
        candidateId={candidate.id}
        existingOffer={editingOffer}
        defaultJobTitle={candidate.roleApplied || candidate.appliedRole}
        show={showCreateModal}
        onHide={() => {
          setShowCreateModal(false);
          setEditingOffer(null);
        }}
      />

      {activeDecisionOffer && (
        <OfferDecisionModal
          candidateId={candidate.id}
          offer={activeDecisionOffer}
          show={showDecisionModal}
          onHide={() => {
            setShowDecisionModal(false);
            setActiveDecisionOffer(null);
          }}
        />
      )}
    </>
  );
}
