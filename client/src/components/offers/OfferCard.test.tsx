import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import OfferCard from './OfferCard';
import { extendOffer, getCandidateOffers, submitOfferForApproval } from '../../services/api';
import type { CandidateDetail, Offer, OfferApproval } from '../../types';

vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ isAdminOrAbove: true }) }));
vi.mock('../../services/api', () => ({
  downloadOfferPdf: vi.fn(),
  extendOffer: vi.fn(),
  getCandidateOffers: vi.fn(),
  reviewOfferApproval: vi.fn(),
  submitOfferForApproval: vi.fn(),
}));
vi.mock('./CreateOfferModal', () => ({ default: () => null }));
vi.mock('./OfferDecisionModal', () => ({ default: () => null }));

const candidate = { id: 42, fullName: 'Jane Doe', currentStatus: 'Offer Preparation' } as CandidateDetail;

const approval = (status: OfferApproval['status'], comment: string | null = null): OfferApproval => ({
  id: 1, offerId: 7, approverUserId: 1, approverName: 'Ada Admin', approverEmail: 'ada@test.local',
  status, comment, reviewedAt: '2026-10-20T10:00:00Z', createdAt: '2026-10-20T09:00:00Z',
});

const offer = (status: Offer['status'], approvals: OfferApproval[] = []): Offer => ({
  id: 7, candidateId: 42, candidateName: 'Jane Doe', candidateEmail: 'jane@test.local', jobTitle: 'Engineer',
  baseSalary: 100000, currency: 'USD', bonus: null, equity: null, startDate: null, expirationDate: null,
  notes: null, status, createdByUserId: 1, createdByName: 'Rita', createdAt: '2026-10-20T08:00:00Z',
  updatedAt: '2026-10-20T08:00:00Z', extendedAt: null, respondedAt: null, declineReason: null, approvals,
});

const renderCard = () => renderWithProviders(<OfferCard candidate={candidate} />);

describe('OfferCard: offers only the actions the offer state allows (#192)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps Edit, Request Approval and Extend on a draft that was never rejected (approval is optional)', async () => {
    vi.mocked(getCandidateOffers).mockResolvedValue([offer('Draft')]);
    renderCard();

    expect(await screen.findByRole('button', { name: /Edit/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Request Approval/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Extend Offer$/ })).toBeInTheDocument();
    expect(screen.queryByText(/rejected this offer/)).not.toBeInTheDocument();
  });

  it('hides Extend on a rejected draft and says what to do instead, with the Admin\'s comment', async () => {
    vi.mocked(getCandidateOffers).mockResolvedValue([offer('Draft', [approval('Rejected', 'Salary too high')])]);
    renderCard();

    expect(await screen.findByRole('button', { name: /Request Approval/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Extend Offer/ })).not.toBeInTheDocument();
    const note = screen.getByLabelText('Offer rejected');
    expect(note).toHaveTextContent('An Admin rejected this offer: Salary too high');
    expect(note).toHaveTextContent('request approval again before extending it');
  });

  it('offers Extend only after approval, and no Edit once the offer is approved', async () => {
    vi.mocked(getCandidateOffers).mockResolvedValue([offer('Approved', [approval('Approved')])]);
    renderCard();

    expect(await screen.findByRole('button', { name: /Extend Offer to Candidate/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Request Approval/ })).not.toBeInTheDocument();
  });

  it('offers neither Extend nor Edit while the offer waits for an Admin', async () => {
    vi.mocked(getCandidateOffers).mockResolvedValue([offer('PendingApproval')]);
    renderCard();

    expect(await screen.findByRole('button', { name: /Approve Offer/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Extend/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
  });

  it('shows the server\'s reason when extending is refused, not a generic failure', async () => {
    vi.mocked(getCandidateOffers).mockResolvedValue([offer('Draft')]);
    vi.mocked(extendOffer).mockRejectedValue({
      response: { status: 409, data: 'Offer #7 is awaiting approval, so it cannot be extended until an Admin approves it.' },
    });
    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: /^Extend Offer$/ }));

    expect(await screen.findByText(/awaiting approval, so it cannot be extended/)).toBeInTheDocument();
    expect(screen.queryByText('Failed to extend offer')).not.toBeInTheDocument();
  });

  it('shows the server\'s reason when submitting is refused, and falls back to plain text without one', async () => {
    vi.mocked(getCandidateOffers).mockResolvedValue([offer('Draft')]);
    vi.mocked(submitOfferForApproval).mockRejectedValueOnce({ response: { status: 409, data: 'Offer #7 is \'Accepted\', so it cannot be submitted for approval.' } });
    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: /Request Approval/ }));
    expect(await screen.findByText(/cannot be submitted for approval/)).toBeInTheDocument();

    vi.mocked(submitOfferForApproval).mockRejectedValueOnce(new Error('network'));
    await userEvent.click(screen.getByRole('button', { name: /Request Approval/ }));
    expect(await screen.findByText('Failed to submit offer for approval')).toBeInTheDocument();
  });
});
