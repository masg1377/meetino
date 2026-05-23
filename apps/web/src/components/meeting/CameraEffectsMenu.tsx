'use client';
import { useEffect, useRef, useState } from 'react';
import { ImageIcon, Sparkles, X } from 'lucide-react';
import type { UseCameraEffects } from '@/hooks/useCameraEffects';
import { Alert } from '@/components/ui/Alert';
import { t } from '@/lib/i18n';

/**
 * Phase 7.7 — popover menu next to the camera button.
 *
 * Three quick choices (none / blur / virtual) + a "pick a background"
 * file picker. On unsupported devices we show a Persian fallback and
 * disable the options.
 *
 * The menu closes on outside click and Escape; both common patterns.
 */
export function CameraEffectsMenu({
  effects,
  open,
  onClose,
}: {
  effects: UseCameraEffects;
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [imgError, setImgError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Click handler is bound with a tiny delay so the opening click doesn't close us.
    const id = setTimeout(() => document.addEventListener('mousedown', onDoc), 0);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="absolute bottom-full end-0 z-40 mb-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900"
      role="menu"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
          <Sparkles className="h-4 w-4 text-brand-600" />
          {t.cameraEffects.title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label={t.common.close}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {effects.unsupported && (
        <Alert variant="warning">{t.cameraEffects.unsupported}</Alert>
      )}

      <div className="grid grid-cols-3 gap-2">
        <EffectTile
          label={t.cameraEffects.options.none}
          active={effects.effect === 'none'}
          disabled={effects.isApplying}
          onClick={() => effects.setEffect('none')}
        >
          <div className="grid h-10 w-full place-items-center rounded-md bg-slate-100 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            —
          </div>
        </EffectTile>
        <EffectTile
          label={t.cameraEffects.options.blur}
          active={effects.effect === 'blur'}
          disabled={effects.isApplying || effects.unsupported}
          onClick={() => effects.setEffect('blur')}
        >
          <div className="h-10 w-full rounded-md bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300 blur-[1px] dark:from-slate-700 dark:via-slate-800 dark:to-slate-900" />
        </EffectTile>
        <EffectTile
          label={t.cameraEffects.options.virtual}
          active={effects.effect === 'virtual'}
          disabled={effects.isApplying || effects.unsupported}
          onClick={() => effects.setEffect('virtual')}
        >
          {effects.virtualImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={effects.virtualImage}
              alt=""
              className="h-10 w-full rounded-md object-cover"
            />
          ) : (
            <div className="grid h-10 w-full place-items-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-200">
              <ImageIcon className="h-4 w-4" />
            </div>
          )}
        </EffectTile>
      </div>

      <div className="mt-3 space-y-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={effects.unsupported}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <ImageIcon className="h-4 w-4" />
          {t.cameraEffects.chooseImage}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            setImgError(null);
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
              setImgError(t.cameraEffects.imageTooLarge);
              e.target.value = '';
              return;
            }
            effects.setVirtualImage(file);
            e.target.value = '';
          }}
        />
        {effects.virtualImage && (
          <button
            type="button"
            onClick={() => {
              effects.setVirtualImage(null);
              if (effects.effect === 'virtual') effects.setEffect('none');
            }}
            className="w-full rounded-xl px-3 py-1.5 text-xs text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {t.cameraEffects.removeImage}
          </button>
        )}
        {imgError && <Alert variant="error">{imgError}</Alert>}
        {effects.error && (
          <Alert variant="error" onDismiss={effects.clearError}>
            {effects.error}
          </Alert>
        )}
      </div>
    </div>
  );
}

function EffectTile({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex flex-col items-stretch gap-1 rounded-xl p-2 text-center text-xs transition',
        active
          ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-300 dark:bg-brand-900/40 dark:text-brand-200 dark:ring-brand-700'
          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
        disabled ? 'cursor-not-allowed opacity-60 hover:bg-inherit' : '',
      ].join(' ')}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}
