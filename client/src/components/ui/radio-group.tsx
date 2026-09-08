import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Circle } from 'lucide-react';
import type * as React from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * A radio group. Radix owns the roving focus and arrow-key movement that a set
 * of loose `<input type="radio">` elements sharing a `name` never had.
 */
function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn('grid gap-2', className)}
      {...props}
    />
  );
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        'aspect-square size-4 shrink-0 rounded-full border border-[var(--border-strong)] bg-muted shadow-[var(--shadow-xs)]',
        'transition-[border-color,box-shadow] duration-[var(--dur-fast)]',
        'data-[state=checked]:border-primary',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] outline-none',
        'disabled:cursor-not-allowed disabled:opacity-55',
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className="size-2 fill-primary text-brand" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}

/** One option with its label, so clicking the words selects it. */
function RadioOption({
  value,
  id,
  children,
  disabled,
}: {
  value: string;
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <RadioGroupItem value={value} id={id} disabled={disabled} />
      <Label htmlFor={id} className="font-medium">
        {children}
      </Label>
    </div>
  );
}

export { RadioGroup, RadioGroupItem, RadioOption };
