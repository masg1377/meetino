'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

interface AppHeaderProps {
  /** Where the logo links to. Defaults to `/`. */
  homeHref?: string;
  /** Right-aligned slot (user menu, CTA buttons, etc.). */
  rightSlot?: ReactNode;
  /** Optional inline navigation links. */
  nav?: Array<{ href: string; label: string }>;
  /** Use a transparent variant on top of gradient/landing surfaces. */
  variant?: 'solid' | 'transparent';
  /** Centered title for context (e.g. meeting title on the room page). */
  centerSlot?: ReactNode;
  /** Tighter vertical padding for compact pages like the meeting room. */
  compact?: boolean;
}

/**
 * Shared top navigation used across landing, auth, and dashboard surfaces.
 * Keep this component dumb — no auth fetching, no routing logic. Pages pass
 * exactly what they want shown on the right via `rightSlot`.
 */
export function AppHeader({
  homeHref = '/',
  rightSlot,
  nav,
  variant = 'solid',
  centerSlot,
  compact = false,
}: AppHeaderProps) {
  const bg =
    variant === 'transparent'
      ? 'bg-transparent'
      : 'border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80';

  return (
    <header className={`${bg} sticky top-0 z-30`}>
      <div
        className={[
          'mx-auto flex max-w-6xl items-center gap-4 px-6',
          compact ? 'py-3' : 'py-4',
        ].join(' ')}
      >
        <Link href={homeHref} aria-label="میتینو" className="shrink-0">
          <Logo />
        </Link>

        {nav && nav.length > 0 && (
          <nav className="hidden flex-1 items-center gap-6 ps-6 md:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        {centerSlot && <div className="hidden flex-1 md:block">{centerSlot}</div>}

        <div className="ms-auto flex items-center gap-2">
          <ThemeToggle />
          {rightSlot}
        </div>
      </div>
    </header>
  );
}
