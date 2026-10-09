import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OfferMetricsCard from './OfferMetricsCard';
import type { OfferMetrics } from '../../types';

describe('OfferMetricsCard', () => {
  const mockMetrics: OfferMetrics = {
    totalOffers: 12,
    activeOffers: 4,
    acceptedOffers: 7,
    declinedOffers: 1,
    totalHired: 6,
    acceptanceRatePercentage: 87.5,
  };

  it('renders the offer steps, the active count and the acceptance rate', () => {
    render(<OfferMetricsCard metrics={mockMetrics} />);

    expect(screen.getByRole('heading', { name: 'Offers' })).toBeInTheDocument();
    expect(screen.getByText('4 offers still active.')).toBeInTheDocument();
    expect(screen.getByText('87.5% accepted')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('7 of 8 decided')).toBeInTheDocument();
  });
});
