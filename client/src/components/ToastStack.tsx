import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

type ToastVariant = 'success' | 'danger' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  addToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({ addToast: () => {} });

/** How long a toast stays up. An error is usually longer and the one you must not miss. */
const DURATION_MS: Record<ToastVariant, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  danger: 10000,
};

/**
 * Toasts are tinted, not filled.
 *
 * The version this replaces used Bootstrap's `text-bg-success` / `text-bg-danger`
 * — a saturated fill with white text — which made a routine "Saved" the single
 * loudest object on the screen, louder than the primary button that caused it.
 * A toast reports that something already happened; it does not need to compete
 * with the thing you are about to do.
 *
 * The tint is only a wash: in dark mode it is ~14% alpha, so a toast floating over
 * a table or a dialog would show that content through its text (#261). Each toast
 * therefore paints the opaque page surface first and layers the tint on top, and a
 * 4px left bar in the variant colour keeps the variant readable at a glance.
 */
const VARIANT: Record<ToastVariant, { className: string; Icon: typeof Info }> = {
  success: {
    className:
      'border-[var(--success-border)] border-l-[var(--success)] bg-[var(--surface)] bg-[image:linear-gradient(var(--success-tint),var(--success-tint))] text-success-foreground',
    Icon: CheckCircle2,
  },
  danger: {
    className:
      'border-[var(--danger-border)] border-l-[var(--danger)] bg-[var(--surface)] bg-[image:linear-gradient(var(--danger-tint),var(--danger-tint))] text-[var(--danger-text)]',
    Icon: XCircle,
  },
  warning: {
    className:
      'border-[var(--warning-border)] border-l-[var(--warning)] bg-[var(--surface)] bg-[image:linear-gradient(var(--warning-tint),var(--warning-tint))] text-[var(--warning-text-strong)]',
    Icon: AlertTriangle,
  },
  info: {
    className:
      'border-[var(--info-border)] border-l-[var(--info)] bg-[var(--surface)] bg-[image:linear-gradient(var(--info-tint),var(--info-tint))] text-info-foreground',
    Icon: Info,
  },
};

/**
 * One toast. It counts down on its own and stops counting while the pointer is
 * over it or focus is inside it (so a long message can be read, or its close
 * button reached); leaving restarts the full countdown.
 */
function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const { className, Icon } = VARIANT[toast.variant];
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(toast.id), DURATION_MS[toast.variant]);
    return () => clearTimeout(timer);
  }, [paused, toast.id, toast.variant, onDismiss]);

  return (
    <div
      data-variant={toast.variant}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={cn(
        'pointer-events-auto flex min-w-56 max-w-[min(24rem,calc(100vw-2rem))] items-start gap-2.5',
        'rounded-[var(--radius-lg)] border border-l-4 px-3 py-2.5 shadow-[var(--shadow-lg)]',
        'animate-in fade-in-0 slide-in-from-bottom-2',
        'text-[length:var(--text-sm)] leading-[var(--leading-normal)]',
        className,
      )}
    >
      <Icon className="mt-px size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
      <span className="min-w-0 flex-1">{toast.message}</span>
      <button
        type="button"
        className="-mr-1 -mt-0.5 grid size-5 shrink-0 place-items-center rounded-[var(--radius-sm)] opacity-60 transition-opacity hover:opacity-100"
        onClick={() => onDismiss(toast.id)}
        aria-label="Close"
      >
        <X className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = 'success') => {
      const id = crypto.randomUUID();
      setToasts((ts) => [...ts, { id, message, variant }]);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/*
        Bottom-right and above everything including a modal: a toast reports
        the outcome of an action that may well have been taken *in* a dialog.

        The region exists even when empty and carries aria-live, so what gets
        announced is the message being inserted — not the region appearing.
        `pointer-events-none` on the stack with `pointer-events-auto` on each
        toast keeps the empty area click-through.
      */}
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-[1090] flex flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
