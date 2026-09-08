import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/**
 * A password field with a show/hide control.
 *
 * One component rather than the toggle repeated at each call site — there are
 * five password inputs across sign-in, change-password and the SMTP settings,
 * and they should all reveal the same way.
 *
 * Notes on the details:
 * - The button is `type="button"`. Inside a <form> a button defaults to
 *   `submit`, so without this, revealing your password would submit the form.
 * - It is a real focusable button with `aria-pressed`, not a decorative icon,
 *   so it is reachable and its state is announced.
 * - The input's right padding clears the button, so a long value scrolls
 *   *behind* it rather than under it.
 * - Revealed state is deliberately local and resets on unmount: it should not
 *   persist across visits to a sign-in screen.
 */
export default function PasswordInput({ className = '', ...props }: Props) {
  const [visible, setVisible] = useState(false);
  const label = visible ? 'Hide password' : 'Show password';

  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('pr-9', className)} />
      <button
        type="button"
        className={cn(
          'absolute top-1/2 right-1 grid size-7 -translate-y-1/2 place-items-center',
          'rounded-[var(--radius-sm)] text-muted-foreground',
          'transition-colors duration-[var(--dur-fast)] hover:bg-muted hover:text-foreground',
          'aria-pressed:text-brand',
          'focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] outline-none',
        )}
        onClick={() => setVisible((v) => !v)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
      >
        {visible ? (
          <EyeOff className="size-4" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Eye className="size-4" strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
