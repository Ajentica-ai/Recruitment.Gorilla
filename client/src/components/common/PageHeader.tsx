import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PageHeaderProps = {
  /**
   * Usually omitted: the topbar already shows the page title, so repeating it
   * here would print it twice. Pass one only for a *section* heading inside a
   * page, or when the heading is content rather than chrome (a candidate's
   * name, say).
   */
  title?: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Right-aligned controls — the primary action for the page. */
  actions?: ReactNode;
};

/**
 * The band above a page's content.
 *
 * Note the actions-only case: most pages pass actions and no title, because
 * the topbar owns the title. Rendering an empty left-hand div to push the
 * buttons right leaves a zero-width flex child that still takes part in
 * wrapping, so the buttons could drop to their own line while the empty div
 * held the first. Switching the justification instead is what actually keeps a
 * lone action cluster on the right.
 */
export default function PageHeader({ title, eyebrow, description, actions }: PageHeaderProps) {
  const hasText = Boolean(title || eyebrow || description);
  if (!hasText && !actions) return null;

  return (
    <div
      className={cn(
        'flex min-h-[var(--control-h)] flex-wrap items-center gap-4',
        hasText ? 'justify-between' : 'justify-end',
      )}
    >
      {hasText && (
        <div className="min-w-0">
          {eyebrow && (
            <span className="block text-[length:var(--text-xs)] font-semibold uppercase tracking-[var(--tracking-caps)] text-muted-foreground">
              {eyebrow}
            </span>
          )}
          {title && (
            <h2 className="text-[length:var(--text-2xl)] font-bold leading-[var(--leading-tight)] tracking-[var(--tracking-display)] [overflow-wrap:anywhere]">
              {title}
            </h2>
          )}
          {description && (
            <p className="mt-0.5 max-w-[70ch] text-[length:var(--text-sm)] leading-[var(--leading-normal)] text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      )}
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
