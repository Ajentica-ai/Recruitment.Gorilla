import { Search } from 'lucide-react';
import type * as React from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * A search field with a leading glyph.
 *
 * WHY THIS IS A COMPONENT AND NOT A CSS RULE. The old `.search-field` class
 * positioned the icon absolutely and cleared it with `padding-left` on
 * `.form-control`. That worked while index.css and Bootstrap were the only
 * two stylesheets. It does not work now: index.css lives in the `legacy`
 * cascade layer, BELOW Tailwind's `utilities`, so its `padding-left` loses to
 * the `pl-2.5` the shadcn <Input> sets on itself — and the icon sat on top of
 * the placeholder with no error anywhere.
 *
 * Anything that needs to override a shadcn primitive has to do it in the same
 * layer, which means passing a class, which means a component.
 */
function SearchInput({
  className,
  wrapperClassName,
  ...props
}: React.ComponentProps<'input'> & { wrapperClassName?: string }) {
  return (
    <div className={cn('relative min-w-0', wrapperClassName)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        strokeWidth={2}
        aria-hidden="true"
      />
      <Input type="search" className={cn('pl-8', className)} {...props} />
    </div>
  );
}

export { SearchInput };
