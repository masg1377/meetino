'use client';
import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { MeetingRoomDto } from '@meetino/shared';
import { apiClient, ApiError } from '@/lib/api-client';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { t } from '@/lib/i18n';

/**
 * Phase 7.6 — full-page screen rendered to a kicked participant.
 *
 * Flow:
 *   1. User sees "you were removed" + a Textarea for an optional message.
 *   2. Tapping "درخواست ورود مجدد" POSTs /meetings/:slug/rejoin-request.
 *   3. After a successful submit we switch to "pending" mode.
 *   4. If the host approves, useMeetingSocket sets myRejoinDecision='APPROVED'
 *      and the room page auto-refreshes — this component just keeps showing
 *      the pending UI until then.
 *   5. If the host rejects, decision='REJECTED' and the screen renders the
 *      rejection state plus an option to retry once more.
 *
 * The parent passes pendingRequestId (from /room response) so a reload mid-
 * approval doesn't show an empty form.
 */
interface Props {
  slug: string;
  initialPendingRequestId: string | null;
  /** From useMeetingSocket.myRejoinDecision. */
  decision: 'APPROVED' | 'REJECTED' | null;
  onLeave: () => void;
}

export function KickedRejoinScreen({
  slug,
  initialPendingRequestId,
  decision,
  onLeave,
}: Props) {
  const [message, setMessage] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(initialPendingRequestId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local override of the parent's `decision` prop — the realtime path
  // can't reach a kicked client, so polling has to be able to flip the
  // UI to "rejected" too.
  const [localDecision, setLocalDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const effectiveDecision = decision ?? localDecision;

  // Phase 7.6 — polling fallback. The kicked user's WebSocket can't
  // reach the gateway (auth rejects wasKicked=true), so we poll the
  // /room endpoint while a request is pending.
  //
  //   /room result          → meaning
  //   wasKicked=false       → host APPROVED. Reload to re-mount the
  //                           socket + LiveKit with a fresh token.
  //   wasKicked=true, no    → host RESOLVED our pending row but left us
  //   pendingRejoinRequestId  kicked — REJECTED. Flip to the rejected UI.
  //   wasKicked=true, same  → still pending; tick again in 5s.
  //   pendingRejoinRequestId
  useEffect(() => {
    if (effectiveDecision === 'REJECTED') return;
    if (!pendingId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const room = await apiClient.get<MeetingRoomDto>(`/meetings/${slug}/room`);
        if (cancelled) return;
        if (!room.wasKicked) {
          // Approved — full reload picks up the new participant state,
          // re-opens the WebSocket, and lets LiveKit mint a fresh token.
          if (typeof window !== 'undefined') window.location.reload();
          return;
        }
        if (!room.pendingRejoinRequestId) {
          // Still kicked but no pending row → host hit "رد درخواست".
          setLocalDecision('REJECTED');
          setPendingId(null);
          return;
        }
      } catch {
        // ignore — next tick will retry
      }
      if (!cancelled) timer = setTimeout(tick, 5_000);
    };

    timer = setTimeout(tick, 5_000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pendingId, effectiveDecision, slug]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post<{ id: string }>(
        `/meetings/${slug}/rejoin-request`,
        { message: message.trim() || undefined },
      );
      setPendingId(res.id);
      // Clear any prior rejection so the UI returns to "pending" state.
      setLocalDecision(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ارسال درخواست ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };

  const showPending = !!pendingId && effectiveDecision !== 'REJECTED';
  const showRejected = effectiveDecision === 'REJECTED';

  return (
    <div className="grid min-h-screen w-screen place-items-center bg-slate-950 px-6 text-center text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-rose-400/20 bg-slate-900 p-8 shadow-2xl">
        <ShieldAlert className="mx-auto h-10 w-10 text-rose-300" />
        <h1 className="mt-4 text-xl font-bold">{t.rejoin.kickedScreen.title}</h1>
        <p className="mt-2 text-sm leading-7 text-slate-300">
          {t.rejoin.kickedScreen.desc}
        </p>

        {error && (
          <div className="mt-5 text-right">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {showRejected ? (
          <div className="mt-5 text-right">
            <Alert variant="error">{t.rejoin.kickedScreen.rejected}</Alert>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              می‌توانید پیام دیگری بنویسید و دوباره درخواست بفرستید.
            </p>
            <div className="mt-3 space-y-3 text-right">
              <Textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t.rejoin.kickedScreen.messagePlaceholder}
                maxLength={280}
                dir="rtl"
              />
              <div className="flex items-center justify-end gap-2">
                <Button variant="secondary" onClick={onLeave}>
                  {t.rejoin.kickedScreen.back}
                </Button>
                <Button onClick={() => void submit()} loading={busy}>
                  {busy ? t.rejoin.kickedScreen.submitting : t.rejoin.kickedScreen.submit}
                </Button>
              </div>
            </div>
          </div>
        ) : showPending ? (
          <div className="mt-6 space-y-4 text-right">
            <Alert variant="info">{t.rejoin.kickedScreen.pending}</Alert>
            <div className="flex items-center justify-end">
              <Button variant="secondary" onClick={onLeave}>
                {t.rejoin.kickedScreen.back}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-3 text-right">
            <Textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t.rejoin.kickedScreen.messagePlaceholder}
              maxLength={280}
              dir="rtl"
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={onLeave}>
                {t.rejoin.kickedScreen.back}
              </Button>
              <Button onClick={() => void submit()} disabled={busy}>
                {busy ? t.rejoin.kickedScreen.submitting : t.rejoin.kickedScreen.submit}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
