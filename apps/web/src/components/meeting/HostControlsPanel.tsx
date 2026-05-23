'use client';
import { useState } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  slug: string;
  /** Latest snapshot from the room DTO + WS overrides. */
  isLocked: boolean;
  hasPassword: boolean;
  isEnded: boolean;
  /** Called after a successful End so the page can route the host away. */
  onEnded?: () => void;
}

/**
 * Host-only controls. Shown ONLY when the room page already knows the user
 * is a host (room.isHost). The backend re-checks role on every endpoint —
 * this UI is convenience, not security.
 */
export function HostControlsPanel({
  slug,
  isLocked,
  hasPassword,
  isEnded,
  onEnded,
}: Props) {
  const [busy, setBusy] = useState<null | 'lock' | 'unlock' | 'end' | 'password' | 'clear-password'>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  const run = async <T,>(kind: typeof busy, fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(kind);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطایی رخ داد.');
      return undefined;
    } finally {
      setBusy(null);
    }
  };

  const onLock = () => run('lock', () => apiClient.patch(`/meetings/${slug}/lock`));
  const onUnlock = () => run('unlock', () => apiClient.patch(`/meetings/${slug}/unlock`));

  const onSetPassword = async () => {
    const value = passwordInput.trim();
    if (value.length < 4) {
      setError('رمز عبور باید حداقل ۴ کاراکتر باشد.');
      return;
    }
    const result = await run('password', () =>
      apiClient.post(`/meetings/${slug}/password`, { password: value }),
    );
    if (result) setPasswordInput('');
  };

  const onClearPassword = () =>
    run('clear-password', () => apiClient.delete(`/meetings/${slug}/password`));

  const confirmEnd = async () => {
    const result = await run('end', () => apiClient.post(`/meetings/${slug}/end`, undefined));
    setShowEndConfirm(false);
    if (result) onEnded?.();
  };

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-amber-900">کنترل میزبان</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
          فقط برای میزبان
        </span>
      </header>

      {error && (
        <div className="mb-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="space-y-3">
        {/* Lock / Unlock */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 ring-1 ring-amber-100">
          <div>
            <div className="text-sm font-medium text-slate-900">قفل جلسه</div>
            <p className="text-xs text-slate-500">
              {isLocked
                ? 'این جلسه قفل است. هیچ شرکت‌کنندهٔ جدیدی نمی‌تواند وارد شود.'
                : 'هرکسی با لینک جلسه می‌تواند وارد شود.'}
            </p>
          </div>
          {isLocked ? (
            <Button size="sm" variant="secondary" disabled={busy !== null || isEnded} onClick={onUnlock}>
              {busy === 'unlock' ? '…' : 'باز کردن'}
            </Button>
          ) : (
            <Button size="sm" disabled={busy !== null || isEnded} onClick={onLock}>
              {busy === 'lock' ? '…' : 'قفل کردن'}
            </Button>
          )}
        </div>

        {/* Password */}
        <div className="rounded-xl bg-white p-3 ring-1 ring-amber-100">
          <div className="mb-2 flex items-baseline justify-between">
            <div className="text-sm font-medium text-slate-900">رمز عبور جلسه</div>
            <span className="text-xs text-slate-500">
              {hasPassword ? 'فعال' : 'غیرفعال'}
            </span>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                type="text"
                placeholder={hasPassword ? 'تغییر رمز عبور…' : 'تنظیم رمز عبور…'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                disabled={busy !== null || isEnded}
              />
            </div>
            <Button
              size="sm"
              onClick={onSetPassword}
              disabled={busy !== null || isEnded || passwordInput.trim().length < 4}
            >
              {busy === 'password' ? '…' : 'ذخیره'}
            </Button>
            {hasPassword && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onClearPassword}
                disabled={busy !== null || isEnded}
              >
                {busy === 'clear-password' ? '…' : 'حذف رمز'}
              </Button>
            )}
          </div>
        </div>

        {/* End meeting */}
        <div className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 ring-1 ring-rose-100">
          <div>
            <div className="text-sm font-medium text-slate-900">پایان دادن جلسه برای همه</div>
            <p className="text-xs text-slate-500">
              این کار قابل بازگشت نیست. همه از جلسه خارج می‌شوند.
            </p>
          </div>
          <Button
            size="sm"
            className="bg-rose-600 hover:bg-rose-700"
            onClick={() => setShowEndConfirm(true)}
            disabled={busy !== null || isEnded}
          >
            پایان جلسه
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={showEndConfirm}
        title="پایان دادن جلسه؟"
        message={
          'با تأیید این عمل، جلسه برای همهٔ شرکت‌کنندگان بسته می‌شود و تماس‌های تصویری قطع خواهند شد. این کار قابل بازگشت نیست.'
        }
        confirmLabel="بله، پایان بده"
        destructive
        busy={busy === 'end'}
        onConfirm={confirmEnd}
        onCancel={() => setShowEndConfirm(false)}
      />
    </section>
  );
}
