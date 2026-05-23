import type { ReactNode } from 'react';
import { X } from 'lucide-react';

type Variant = 'error' | 'success' | 'info' | 'warning';

const variants: Record<Variant, string> = {
  error:
    'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900/60',
  success:
    'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/60',
  info:
    'bg-brand-50 text-brand-800 border-brand-200 dark:bg-brand-950/40 dark:text-brand-100 dark:border-brand-900/60',
  warning:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-900/60',
};

const dismissTone: Record<Variant, string> = {
  error:
    'text-rose-700 hover:bg-rose-100 dark:text-rose-200 dark:hover:bg-rose-900/40',
  success:
    'text-emerald-700 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900/40',
  info:
    'text-brand-700 hover:bg-brand-100 dark:text-brand-100 dark:hover:bg-brand-900/40',
  warning:
    'text-amber-700 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900/40',
};

interface AlertProps {
  variant?: Variant;
  children: ReactNode;
  /** When provided, an X button is rendered in the inline-end corner. */
  onDismiss?: () => void;
  /** Accessible label for the dismiss button. Defaults to "بستن". */
  dismissLabel?: string;
}

export function Alert({
  variant = 'error',
  children,
  onDismiss,
  dismissLabel = 'بستن',
}: AlertProps) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${variants[variant]}`}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className={`-me-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg transition ${dismissTone[variant]}`}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
