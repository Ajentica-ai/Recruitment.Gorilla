import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import CreateOfferModal from './CreateOfferModal';
import { updateOffer } from '../../services/api';
import type { Offer } from '../../types';

vi.mock('../../services/api', () => ({
  createOffer: vi.fn(),
  updateOffer: vi.fn(),
}));

const offer = (patch: Partial<Offer> = {}): Offer => ({
  id: 7, candidateId: 42, candidateName: 'Jane Doe', candidateEmail: 'jane@test.local', jobTitle: 'Engineer',
  baseSalary: 100000, currency: 'USD', bonus: null, equity: null, startDate: null, expirationDate: null,
  notes: null, status: 'Draft', createdByUserId: 1, createdByName: 'Rita', createdAt: '2026-10-20T08:00:00Z',
  updatedAt: '2026-10-20T08:00:00Z', extendedAt: null, respondedAt: null, declineReason: null, approvals: [],
  ...patch,
});

const renderModal = (existing: Offer) =>
  renderWithProviders(<CreateOfferModal candidateId={42} existingOffer={existing} show onHide={() => {}} />);

describe('CreateOfferModal validation messages (#197)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows why an expiry in the past is refused and sends nothing', async () => {
    renderModal(offer({ expirationDate: '2020-01-01T23:59:59Z' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('The offer expiry date cannot be in the past.')).toBeInTheDocument();
    expect(updateOffer).not.toHaveBeenCalled();
  });

  it('shows why an expiry before the start date is refused', async () => {
    renderModal(offer({ startDate: '2099-06-30T00:00:00Z', expirationDate: '2099-06-10T23:59:59Z' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('The offer expiry date cannot be before the start date.')).toBeInTheDocument();
    expect(updateOffer).not.toHaveBeenCalled();
  });

  it('limits the text fields to what the API accepts', async () => {
    renderModal(offer());

    expect(await screen.findByPlaceholderText('e.g. Senior Software Engineer')).toHaveAttribute('maxlength', '200');
    expect(screen.getByPlaceholderText('e.g. 10,000 RSUs or 0.25%')).toHaveAttribute('maxlength', '200');
    expect(screen.getByPlaceholderText(/Standard benefits package/)).toHaveAttribute('maxlength', '2000');
  });

  it('sends a valid edit', async () => {
    vi.mocked(updateOffer).mockResolvedValue(offer());
    renderModal(offer({ expirationDate: '2099-06-10T23:59:59Z' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Save Changes' }));

    expect(updateOffer).toHaveBeenCalledTimes(1);
  });
});
