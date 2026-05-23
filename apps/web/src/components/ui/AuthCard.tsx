'use client';
import type { ReactNode } from 'react';

interface AuthCardProps {
  title: string;
  subtitle?: string;
  /** Optional content shown below the form, like "ثبت‌نام ندارید؟ …". */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Centered card used by the login and register pages. Generous spacing,
 * soft shadow, neutral surface — meant to feel like a focused task rather
 * than a marketing surface.
 */
export function AuthCard({ title, subtitle, footer, children }: AuthCardProps) {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/40 sm:p-10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
          {subtitle && (
            <p className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
        {children}
      </div>
      {footer && (
        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">{footer}</p>
      )}
    </div>
  );
}
