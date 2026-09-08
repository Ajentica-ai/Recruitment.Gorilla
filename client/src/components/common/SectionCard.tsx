import type { ReactNode } from 'react';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * A titled section on a card surface — the workhorse of the dashboard, the
 * candidate detail page and the evaluation report.
 *
 * This replaces the `<Card><Card.Body><div className="metric-label mb-4">…`
 * block that appeared eleven times across the app. Beyond the duplication,
 * that pattern used `.metric-label` (a small muted caption, meant for naming a
 * single figure) as the title of a whole section, so the heading over a chart
 * looked exactly like the caption under a number. A real heading restores the
 * page → section → content hierarchy.
 *
 * `flush` is for a section whose content is a table or list that should meet
 * the card's border rather than sit inside its padding.
 */
export default function SectionCard({
  title,
  description,
  actions,
  children,
  flush = false,
  className = '',
  /** Renders the heading at a given level; the visual size is set by CSS. */
  as: Heading = 'h3',
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
  as?: 'h2' | 'h3' | 'h4';
}) {
  const hasHead = Boolean(title || description || actions);

  return (
    <Card className={cn(flush && 'overflow-hidden', className)}>
      {hasHead && (
        <CardHeader>
          <div className="min-w-0">
            {title && (
              <CardTitle asChild>
                <Heading>{title}</Heading>
              </CardTitle>
            )}
            {description && <CardDescription className="mt-0.5">{description}</CardDescription>}
          </div>
          {actions && <CardAction>{actions}</CardAction>}
        </CardHeader>
      )}
      <CardContent className={cn(flush && 'px-0 pb-0', !hasHead && 'pt-[var(--card-pad)]')}>
        {children}
      </CardContent>
    </Card>
  );
}
