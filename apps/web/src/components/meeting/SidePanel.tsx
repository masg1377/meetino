'use client';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface SidePanelProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Right-side drawer used in the meeting room for Chat and Participants.
 * It mounts inside the dark meeting layout but renders a light surface so
 * the embedded forms (chat input, etc.) stay legible.
 *
 * On lg+ it shows as a fixed 360px column. On smaller screens it slides
 * over the stage.
 */
export function SidePanel({ open, title, subtitle, onClose, children }: SidePanelProps) {
  if (!open) return null;

  return (
    <>
      {/* Mobile overlay */}
      <div
        className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
        onClick={onClose}
        aria-hidden
      />

      <aside
        role="dialog"
        aria-label={title}
        className={[
          'fixed inset-y-0 end-0 z-40 flex w-full max-w-[26rem] flex-col bg-white shadow-2xl dark:bg-slate-900',
          'lg:static lg:z-auto lg:h-full lg:max-w-full lg:flex-1 lg:shadow-none',
        ].join(' ')}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-hidden">{children}</div>
      </aside>
    </>
  );
}
