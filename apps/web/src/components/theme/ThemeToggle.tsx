'use client';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from './ThemeProvider';

interface ThemeToggleProps {
  /** Render as a transparent on-dark surface (e.g. inside the meeting header). */
  variant?: 'default' | 'dark';
  size?: 'sm' | 'md';
}

const LABEL: Record<ThemePreference, string> = {
  light: 'تم: روشن',
  dark: 'تم: تیره',
  system: 'تم: سیستم',
};

const ICON: Record<ThemePreference, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

/**
 * Single-click theme cycle: روشن → تیره → سیستم → روشن …
 * Shows the icon for the *current* preference, not the resolved theme.
 * Tooltip + aria-label expose the cycle for accessibility.
 */
export function ThemeToggle({ variant = 'default', size = 'sm' }: ThemeToggleProps) {
  const { preference, toggle } = useTheme();
  const Icon = ICON[preference];

  const sizeCls = size === 'md' ? 'h-10 w-10' : 'h-9 w-9';
  const palette =
    variant === 'dark'
      ? 'bg-white/10 text-white hover:bg-white/20 focus-visible:outline-white'
      : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:outline-slate-400 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={LABEL[preference]}
      title={LABEL[preference]}
      className={[
        'inline-flex items-center justify-center rounded-full transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        sizeCls,
        palette,
      ].join(' ')}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
