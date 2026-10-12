import type { ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * The overflow menu at the end of a table row.
 *
 * Why this exists: every list in the app used to end each row with one or more
 * full buttons — a red "Delete" on the candidates table, "Edit / Reset
 * password / Deactivate" on the users table. Two consequences, both bad:
 *
 *   1. The most destructive action in the product was rendered forty times per
 *      screen, in the app's danger colour, at full button weight. The loudest
 *      thing on the candidates page was the way to destroy a candidate.
 *   2. The actions column had to be as wide as the widest label, so on the
 *      users page it pushed the table past the viewport — which is where that
 *      page's horizontal scrollbar came from.
 *
 * A single icon trigger fixes both. The actions are one click further away,
 * which is the correct trade for operations performed rarely and never
 * accidentally.
 *
 * On Radix, so the menu portals out of the table's scroll container instead of
 * clipping at its edge.
 *
 * `side="top"`: below 1024px, `.table-cards` reflows each row into a stacked
 * card with this trigger at the card's bottom-right (#65). Radix's collision
 * avoidance only flips placement against the viewport, not sibling elements,
 * so a downward-opening menu there always had room "in the viewport" and
 * covered the next card. Opening upward overlaps the triggering card's own
 * content instead; Radix still flips back to "bottom" when there's no room
 * above (e.g. the first row/card near the top of the page).
 */
export default function RowActions({
  children,
  label = 'Row actions',
}: {
  children: ReactNode;
  /** Announced on the trigger — pass the record's name for a useful one. */
  label?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="iconSm" aria-label={label}>
          <MoreVertical strokeWidth={2} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

/** One entry. `tone="danger"` for a destructive one — the only place in a row
 *  where danger colour is spent, and it is behind a deliberate click. */
export function RowAction({
  icon,
  children,
  onClick,
  tone = 'default',
  disabled,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}) {
  return (
    <DropdownMenuItem
      variant={tone === 'danger' ? 'destructive' : 'default'}
      onSelect={onClick}
      disabled={disabled}
    >
      {icon}
      {children}
    </DropdownMenuItem>
  );
}

export { DropdownMenuSeparator as RowActionSeparator };
