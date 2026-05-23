'use client';
import { useState } from 'react';
import { Check, UserPlus, X } from 'lucide-react';
import type { ParticipantRejoinRequestedPayload } from '@meetino/shared';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { t } from '@/lib/i18n';

/**
 * Phase 7.6 — host-side stacked toast of pending rejoin requests.
 *
 * Rendered only when isHost is true and there's at least one pending row.
 * Tapping تأیید or رد POSTs the respective endpoint; the websocket echo
 * removes the entry from useMeetingSocket.rejoinRequests, which removes
 * it from this UI automatically.
 */
export function RejoinRequestsToast({
  slug,
  requests,
  onDismiss,
}: {
  slug: string;
  requests: ParticipantRejoinRequestedPayload[];
  onDismiss: (requestId: string) => void;
}) {
  if (requests.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-40 flex w-full max-w-sm flex-col gap-3 sm:bottom-20">
      {requests.map((r) => (
        <RejoinCard
          key={r.requestId}
          slug={slug}
          request={r}
          onDismiss={() => onDismiss(r.requestId)}
        />
      ))}
    </div>
  );
}

function RejoinCard({
  slug,
  request,
  onDismiss,
}: {
  slug: string;
  request: ParticipantRejoinRequestedPayload;
  onDismiss: () => void;
}) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (decision: 'approve' | 'reject') => {
    setBusy(decision);
    setError(null);
    try {
      await apiClient.post(
        `/meetings/${slug}/rejoin-requests/${request.requestId}/${decision}`,
      );
      // The WS echo (REJOIN_APPROVED / REJOIN_REJECTED) clears the row.
      onDismiss();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'انجام نشد. دوباره تلاش کنید.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="pointer-events-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:ring-slate-800">
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-200">
          <UserPlus className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {t.rejoin.host.toast}
          </p>
          <p className="mt-0.5 truncate text-sm text-slate-700 dark:text-slate-200">
            {request.displayName}
            <span className="ms-1 text-xs text-slate-400">
              ·{' '}
              {request.participantType === 'GUEST'
                ? t.details.attendance.kindGuest
                : t.details.attendance.kindRegistered}
            </span>
          </p>
          {request.message && (
            <p className="mt-1 line-clamp-3 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
              «{request.message}»
            </p>
          )}
          {error && (
            <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{error}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label={t.common.dismiss}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void act('reject')}
          disabled={busy !== null}
        >
          <X className="h-3.5 w-3.5" />
          {t.rejoin.host.reject}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => void act('approve')}
          disabled={busy !== null}
        >
          <Check className="h-3.5 w-3.5" />
          {t.rejoin.host.approve}
        </Button>
      </div>
    </div>
  );
}
