'use client';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { UseCameraEffects } from '@/hooks/useCameraEffects';
import { t } from '@/lib/i18n';
import { CameraEffectsMenu } from './CameraEffectsMenu';

/**
 * Phase 7.7 — toolbar slot that owns the camera-effects popover state.
 *
 * Rendered inline next to the camera button in the meeting toolbar.
 * The button itself shows a sparkle (active = effect != 'none').
 */
export function CameraEffectsButton({ effects }: { effects: UseCameraEffects }) {
  const [open, setOpen] = useState(false);
  const active = effects.effect !== 'none';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t.toolbar.effects}
        aria-pressed={active}
        aria-expanded={open}
        title={t.toolbar.effects}
        className={[
          'inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
          active
            ? 'bg-brand-500 text-white hover:bg-brand-400'
            : 'bg-white/10 text-white hover:bg-white/20',
        ].join(' ')}
      >
        <Sparkles className="h-5 w-5" />
      </button>
      <CameraEffectsMenu effects={effects} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
