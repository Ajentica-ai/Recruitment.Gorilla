import type { OfferMetrics } from '../../types';
import SectionCard from '../common/SectionCard';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface OfferMetricsCardProps {
  metrics: OfferMetrics;
}

/**
 * Offers as three steps (made, accepted, hired) and the acceptance rate. The
 * old card spent four bordered boxes and a header strip on the same figures.
 */
export default function OfferMetricsCard({ metrics }: OfferMetricsCardProps) {
  const decided = metrics.acceptedOffers + metrics.declinedOffers;
  const good = metrics.acceptanceRatePercentage >= 75;

  return (
    <SectionCard
      title="Offers"
      description={`${metrics.activeOffers} offer${metrics.activeOffers === 1 ? '' : 's'} still active.`}
      actions={
        <Badge variant={good ? 'success' : 'neutral'}>{metrics.acceptanceRatePercentage}% accepted</Badge>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="offer-steps">
          <div className="offer-step">
            <span className="offer-step__value">{metrics.totalOffers}</span>
            <span className="offer-step__label">Offers made</span>
          </div>
          <div className="offer-step offer-step--good">
            <span className="offer-step__value">{metrics.acceptedOffers}</span>
            <span className="offer-step__label">Accepted</span>
          </div>
          <div className="offer-step">
            <span className="offer-step__value">{metrics.totalHired}</span>
            <span className="offer-step__label">Hired</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[length:var(--text-xs)] font-semibold text-muted-foreground">
            <span>Acceptance</span>
            <span>
              {metrics.acceptedOffers} of {decided} decided
            </span>
          </div>
          <Progress
            value={metrics.acceptanceRatePercentage}
            aria-label={`Offer acceptance ${metrics.acceptanceRatePercentage} percent`}
            className="h-2 bg-muted"
            indicatorClassName={good ? 'bg-[var(--success)]' : 'bg-primary'}
          />
        </div>
      </div>
    </SectionCard>
  );
}
