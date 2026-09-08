import * as LabelPrimitive from '@radix-ui/react-label';
import type * as React from 'react';
import { cn } from '@/lib/utils';

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        'flex items-center gap-1 text-[length:var(--text-sm)] font-semibold text-text-soft select-none',
        'group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-55',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
