import { useId, type ReactNode } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * A labelled form field: label, control, and optional help or error text.
 *
 * This exists because `Form.Group` + `Form.Label` + `Form.Control` +
 * `Form.Text` + `Form.Control.Feedback` was five components to express one
 * field, and the wiring between them (`controlId` threading an id down to the
 * control and the label) was easy to forget — several fields in the app had a
 * label that pointed at nothing.
 *
 * Here the id is generated once and handed to the child through a render prop,
 * so label/control/description/error are always associated. `aria-describedby`
 * is assembled from whichever of help and error is actually present.
 */
export function Field({
  label,
  required,
  help,
  error,
  className,
  children,
}: {
  label?: ReactNode;
  /** Renders the required marker AND sets `required` on the control. */
  required?: boolean;
  help?: ReactNode;
  /** When set, the control is marked invalid and this replaces the help text. */
  error?: ReactNode;
  className?: string;
  children: (props: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': boolean | undefined;
    required: boolean | undefined;
  }) => ReactNode;
}) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && (
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </Label>
      )}
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        required: required || undefined,
      })}
      {error ? (
        <p id={errorId} className="text-[length:var(--text-sm)] text-[var(--danger-text)]">
          {error}
        </p>
      ) : (
        help && (
          <p
            id={helpId}
            className="text-[length:var(--text-sm)] leading-[var(--leading-normal)] text-muted-foreground"
          >
            {help}
          </p>
        )
      )}
    </div>
  );
}

/**
 * The vertical rhythm between fields, replacing a bottom margin on every
 * field. A gap on the container means the last field has no trailing margin
 * fighting the container's padding, and a conditionally rendered field can't
 * leave a phantom gap behind when it disappears.
 */
export function FieldStack({
  className,
  tight = false,
  ...props
}: React.ComponentProps<'div'> & { tight?: boolean }) {
  return (
    <div
      className={cn('flex flex-col', tight ? 'gap-3' : 'gap-4', className)}
      {...props}
    />
  );
}

/** Two fields side by side above `sm`, stacked below. Replaces the Row/Col
 *  pairs that were the only reason Bootstrap's grid was still imported. */
export function FieldRow({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2', className)} {...props} />
  );
}

/**
 * The action row that closes a form. The top border separates committing from
 * editing, which is the one place in a form where a rule earns its keep.
 *
 * On a phone the buttons go full width and the primary one leads, so it is
 * under the thumb rather than tucked beside a Cancel.
 */
export function FormActions({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'mt-5 flex flex-col-reverse gap-2 border-t border-line pt-5',
        'sm:flex-row sm:items-center',
        '[&>*]:w-full sm:[&>*]:w-auto',
        className,
      )}
      {...props}
    />
  );
}

/** A titled group of fields inside one form. */
export function FormSection({
  title,
  className,
  children,
}: {
  title?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'flex flex-col gap-4',
        '[&+&]:mt-5 [&+&]:border-t [&+&]:border-line [&+&]:pt-5',
        className,
      )}
    >
      {title && (
        <h4 className="text-[length:var(--text-md)] font-semibold text-foreground">{title}</h4>
      )}
      {children}
    </section>
  );
}

/**
 * A checkbox with its label on one line.
 *
 * The label is a real `<Label htmlFor>` rather than text beside the box, so
 * clicking the words toggles the control — which Bootstrap's Form.Check gave
 * us for free and is the single easiest thing to lose in a hand-rolled
 * replacement.
 */
export function CheckboxField({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const hasDescription = Boolean(description);

  return (
    <div
      className={cn(
        'flex min-h-[var(--control-h-sm)] gap-2',
        hasDescription ? 'items-start' : 'items-center',
        className,
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        disabled={disabled}
        className={hasDescription ? 'mt-0.5' : undefined}
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <Label htmlFor={id} className="font-medium cursor-pointer">
          {label}
        </Label>
        {description && (
          <p className="text-[length:var(--text-sm)] text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

/**
 * A set of related checkboxes (roles, options). Auto-fit columns rather than a
 * flex row, so the boxes line up in a grid instead of ragging wherever the
 * previous label happened to end.
 */
export function CheckGrid({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('grid gap-x-4 gap-y-2 [grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))]', className)}
      {...props}
    />
  );
}
