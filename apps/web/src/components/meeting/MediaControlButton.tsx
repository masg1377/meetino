'use client';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface MediaControlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Whether the underlying state is "on" (mic open, camera on, etc.). */
  active: boolean;
  /** Lucide icon shown when active. */
  iconOn: ReactNode;
  /** Lucide icon shown when inactive. */
  iconOff: ReactNode;
  /** Accessible label — also used as tooltip. */
  label: string;
  /** Render with a destructive red color (used for the hangup button). */
  destructive?: boolean;
}

/**
 * Round pill button used in the bottom toolbar of the meeting room and
 * inside the pre-join media preview. Inspired by Google Meet's "pill"
 * controls: filled background when off, neutral/transparent when on.
 *
 * Inactive (off) controls are styled red to clearly signal "this is muted".
 */
export function MediaControlButton({
  active,
  iconOn,
  iconOff,
  label,
  destructive = false,
  className = '',
  ...rest
}: MediaControlButtonProps) {
  const palette = destructive
    ? 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-rose-600'
    : active
      ? 'bg-white/10 text-white hover:bg-white/20 focus-visible:outline-white'
      : 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-rose-600';

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={!destructive ? active : undefined}
      title={label}
      className={[
        // Slightly smaller on mobile so 4 media + 2 panel buttons fit on
        // 360–400px wide phones without wrapping.
        'inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors sm:h-12 sm:w-12',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        palette,
        className,
      ].join(' ')}
      {...rest}
    >
      {active ? iconOn : iconOff}
    </button>
  );
}
