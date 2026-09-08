import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * shadcn's class helper: `clsx` for conditional classes, `tailwind-merge` to
 * resolve conflicts so a caller's `className` genuinely overrides the
 * component's default rather than depending on source order.
 *
 * Without the merge, `<Button className="h-9">` would emit `h-[var(--control-h)] h-9`
 * and the winner would be whichever Tailwind emitted last — which is stable
 * but not what the author meant.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
