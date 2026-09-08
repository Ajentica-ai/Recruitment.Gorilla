// Dashboard KPI icons. Thin wrappers over lucide-react so call sites keep the
// names they always used and the size/stroke stay consistent with the rest of
// the shell.

import {
  CalendarPlus,
  Hourglass,
  IdCard,
  Share2,
  UserCheck,
  UserX,
  type LucideProps,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const base: LucideProps = {
  size: 18,
  strokeWidth: 2,
  'aria-hidden': true,
};

interface IconProps {
  className?: string;
}

/** Total — id card. */
export const IdCardIcon = ({ className }: IconProps = {}) => (
  <IdCard {...base} className={cn('text-blue-500', className)} />
);

/** In process — hourglass. */
export const HourglassIcon = ({ className }: IconProps = {}) => (
  <Hourglass {...base} className={cn('text-amber-500', className)} />
);

/** Recommended — person with check. */
export const PersonCheckIcon = ({ className }: IconProps = {}) => (
  <UserCheck {...base} className={cn('text-emerald-500', className)} />
);

/** Rejected — person with x. */
export const PersonXIcon = ({ className }: IconProps = {}) => (
  <UserX {...base} className={cn('text-rose-500', className)} />
);

/** New this week — calendar with plus. */
export const CalendarPlusIcon = ({ className }: IconProps = {}) => (
  <CalendarPlus {...base} className={cn('text-cyan-500', className)} />
);

/** Referred — share arrows. */
export const ShareIcon = ({ className }: IconProps = {}) => (
  <Share2 {...base} className={cn('text-purple-500', className)} />
);
