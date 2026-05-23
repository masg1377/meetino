'use client';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** Lucide icon component (already-rendered JSX is also fine). */
  icon: ReactNode;
  title: string;
  description?: string;
  /** Optional CTA slot. */
  action?: ReactNode;
  /** Visual treatment — dashed border for "nothing yet" vs. solid card for errors. */
  variant?: 'default' | 'soft';
  className?: string;
}

/**
 * Reusable empty-state card. Used by the dashboard meetings list and
 * anywhere else there's "nothing to show yet" content.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'default',
  className = '',
}: EmptyStateProps) {
  const surface =
    variant === 'soft'
      ? 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
      : 'border border-dashed border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900/40';

  return (
    <div
      className={[
        'flex flex-col items-center justify-center gap-3 rounded-3xl p-12 text-center',
        surface,
        className,
      ].join(' ')}
    >
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      {description && (
        <p className="max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
