import { Avatar as AvatarRoot, AvatarFallback } from '@/components/ui/avatar';
import { initialsOf } from '@/utils/initials';
import { avatarTone } from '@/utils/avatarTone';
import { cn } from '@/lib/utils';

type AvatarSize = 'sm' | 'md' | 'lg' | 'hero';

const SIZE_CLASS: Record<AvatarSize, string> = {
  sm: 'size-6 [&_[data-slot=avatar-fallback]]:text-[length:var(--text-2xs)]',
  md: 'size-7',
  lg: 'size-9 [&_[data-slot=avatar-fallback]]:text-[length:var(--text-sm)]',
  hero: 'size-11 [&_[data-slot=avatar-fallback]]:text-[length:var(--text-lg)]',
};

/**
 * Initials on a tinted disc, tinted deterministically from the name.
 *
 * This replaces the four hand-rolled copies that existed — the status
 * timeline, the interview page, the sidebar user card and the job-opening
 * recruiter stack each built their own — and, more importantly, it is what
 * puts a face on the candidate list. The old table was six columns of grey
 * text; the identity column now leads with a coloured disc, which is what
 * makes a 44px row worth more than a bare one.
 *
 * `name` is both the label and the tone seed, so the same person is the same
 * colour on every screen.
 */
export default function Avatar({
  name,
  email,
  size = 'md',
  className = '',
}: {
  name: string | null | undefined;
  /** Fallback for the initials when there is no display name. */
  email?: string | null;
  size?: AvatarSize;
  className?: string;
}) {
  const label = name || email || '';

  return (
    <AvatarRoot
      className={cn(SIZE_CLASS[size], className)}
      style={avatarTone(label)}
      aria-hidden="true"
    >
      <AvatarFallback>{initialsOf(name, email)}</AvatarFallback>
    </AvatarRoot>
  );
}
