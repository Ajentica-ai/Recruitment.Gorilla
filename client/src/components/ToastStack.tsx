import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

type ToastVariant = 'success' | 'danger' | 'warning' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  addToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({ addToast: () => {} });

/**
 * Toasts are tinted, not filled.
 *
 * The version this replaces used Bootstrap's `text-bg-success` / `text-bg-danger`
 * — a saturated fill with white text — which made a routine "Saved" the single
 * loudest object on the screen, louder than the primary button that caused it.
 * A toast reports that something already happened; it does not need to compete
 * with the thing you are about to do.
 */
const VARIANT: Record<ToastVariant, { className: string; Icon: typeof Info }> = {
  success: {
    className: 'border-[var(--success-border)] bg-success-muted text-success-foreground',
    Icon: CheckCircle2,
  },
  danger: {
    className: 'border-[var(--danger-border)] bg-danger-muted text-[var(--danger-text)]',
    Icon: XCircle,
  },
  warning: {
    className: 'border-[var(--warning-border)] bg-warning-muted text-[var(--warning-text-strong)]',
    Icon: AlertTriangle,
  },
  info: {
    className: 'border-[var(--info-border)] bg-info-muted text-info-foreground',
    Icon: Info,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = 'success') => {
      const id = Date.now();
      setToasts((ts) => [...ts, { id, message, variant }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
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
        {toasts.map((t) => {
          const { className, Icon } = VARIANT[t.variant];
          return (
            <div
              key={t.id}
              className={cn(
                'pointer-events-auto flex min-w-56 max-w-[min(24rem,calc(100vw-2rem))] items-start gap-2.5',
                'rounded-[var(--radius-lg)] border px-3 py-2.5 shadow-[var(--shadow-lg)]',
                'animate-in fade-in-0 slide-in-from-bottom-2',
                'text-[length:var(--text-sm)] leading-[var(--leading-normal)]',
                className,
              )}
            >
              <Icon className="mt-px size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              <span className="min-w-0 flex-1">{t.message}</span>
              <button
                type="button"
                className="-mr-1 -mt-0.5 grid size-5 shrink-0 place-items-center rounded-[var(--radius-sm)] opacity-60 transition-opacity hover:opacity-100"
                onClick={() => remove(t.id)}
                aria-label="Close"
              >
                <X className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
