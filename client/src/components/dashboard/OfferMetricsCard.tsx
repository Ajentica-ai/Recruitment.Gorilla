import { Award, CheckCircle, FileSignature } from 'lucide-react';
import type { OfferMetrics } from '../../types';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface OfferMetricsCardProps {
  metrics: OfferMetrics;
}

export default function OfferMetricsCard({ metrics }: OfferMetricsCardProps) {
  return (
    <Card className="rg-card mb-4">
      <CardHeader className="flex items-center justify-between py-2 px-4 bg-transparent">
        <div className="flex items-center gap-2">
          <FileSignature size={18} className="text-brand" />
          <span className="font-bold text-[length:var(--text-sm)]">Offer & Hiring Conversion</span>
        </div>
        <Badge variant={metrics.acceptanceRatePercentage >= 75 ? 'success' : 'neutral'} className="font-normal">
          {metrics.acceptanceRatePercentage}% Acceptance Rate
        </Badge>
      </CardHeader>

      <CardContent className="p-4">
        <div className="grid grid-cols-12 gap-6 text-center mb-4">
          <div className="col-span-12 col-span-6 sm:col-span-3">
            <div className="p-2 border border-border rounded-[var(--radius-md)]">
              <div className="text-muted-foreground text-[length:var(--text-sm)] mb-1">Total Offers</div>
              <div className="text-[length:var(--text-xl)] font-bold text-brand">{metrics.totalOffers}</div>
            </div>
          </div>
          <div className="col-span-12 col-span-6 sm:col-span-3">
            <div className="p-2 border border-border rounded-[var(--radius-md)]">
              <div className="text-muted-foreground text-[length:var(--text-sm)] mb-1">Active Offers</div>
              <div className="text-[length:var(--text-xl)] font-bold text-info-foreground">{metrics.activeOffers}</div>
            </div>
          </div>
          <div className="col-span-12 col-span-6 sm:col-span-3">
            <div className="p-2 border border-border rounded-[var(--radius-md)]">
              <div className="text-muted-foreground text-[length:var(--text-sm)] mb-1">Accepted</div>
              <div className="text-[length:var(--text-xl)] font-bold text-success-foreground flex items-center justify-center gap-1">
                <CheckCircle size={16} /> {metrics.acceptedOffers}
              </div>
            </div>
          </div>
          <div className="col-span-12 col-span-6 sm:col-span-3">
            <div className="p-2 border border-border rounded-[var(--radius-md)]">
              <div className="text-muted-foreground text-[length:var(--text-sm)] mb-1">Total Hired</div>
              <div className="text-[length:var(--text-xl)] font-bold text-success-foreground flex items-center justify-center gap-1">
                <Award size={16} /> {metrics.totalHired}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2">
          <div className="flex justify-between items-center text-[length:var(--text-sm)] mb-1">
            <span className="text-muted-foreground">Offer Acceptance Ratio</span>
            <span className="font-semibold">
              {metrics.acceptedOffers} Accepted / {metrics.acceptedOffers + metrics.declinedOffers} Decided ({metrics.acceptanceRatePercentage}%)
            </span>
          </div>
          <Progress
            value={metrics.acceptanceRatePercentage}
            className="h-1.5 bg-muted/30"
            indicatorClassName={
              metrics.acceptanceRatePercentage >= 75
                ? 'bg-emerald-500/80 dark:bg-emerald-500/70'
                : 'bg-primary/80 dark:bg-primary/70'
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
