'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock, LockKeyhole } from 'lucide-react';
import {
  ConnectionStatus,
  type MeetingRoomDto,
  type ParticipantState,
} from '@meetino/shared';
import { apiClient, ApiError } from '@/lib/api-client';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useMeetingSocket } from '@/hooks/useMeetingSocket';
import { useLivekitRoom } from '@/hooks/useLivekitRoom';
import { Logo } from '@/components/Logo';
import { ParticipantList } from '@/components/meeting/ParticipantList';
import { ChatPanel } from '@/components/meeting/ChatPanel';
import { VideoGrid } from '@/components/meeting/VideoGrid';
import { HostControlsPanel } from '@/components/meeting/HostControlsPanel';
import { ConfirmDialog } from '@/components/meeting/ConfirmDialog';
import { MeetingToolbar } from '@/components/meeting/MeetingToolbar';
import { SidePanel } from '@/components/meeting/SidePanel';
import { RecordingButton } from '@/components/meeting/RecordingButton';
import { KickedRejoinScreen } from '@/components/meeting/KickedRejoinScreen';
import { RejoinRequestsToast } from '@/components/meeting/RejoinRequestsToast';
import { WhiteboardPanel } from '@/components/meeting/whiteboard/WhiteboardPanel';
import { FilesPanel } from '@/components/meeting/files/FilesPanel';
import { CameraEffectsButton } from '@/components/meeting/CameraEffectsButton';
import { useLocalRecorder } from '@/hooks/useLocalRecorder';
import { useCameraEffects } from '@/hooks/useCameraEffects';
import { useMeetingFiles } from '@/hooks/useMeetingFiles';
import type { LocalVideoTrack } from 'livekit-client';
import { t } from '@/lib/i18n';

export default function RoomPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const router = useRouter();
  const { isHydrated } = useAuth();

  const [data, setData] = useState<MeetingRoomDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Phase 3: confirm we are a real participant for this slug.
  useEffect(() => {
    if (!slug || !isHydrated) return;
    let cancelled = false;
    (async () => {
      try {
        const room = await apiClient.get<MeetingRoomDto>(`/meetings/${slug}/room`);
        if (!cancelled) setData(room);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace(`/m/${slug}/prejoin`);
          return;
        }
        setError(err instanceof ApiError ? err.message : 'بارگذاری اتاق با خطا مواجه شد.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, router, isHydrated]);

  // Phase 4 realtime + Phase 7 security state.
  //
  // Phase 7.6 — when the caller is currently flagged kicked, the gateway
  // refuses their handshake. Passing null here stops the client from
  // retrying that handshake every few hundred ms while the kicked screen
  // is visible. The KickedRejoinScreen polls /room directly to detect
  // approval; on approval we hard-reload the page, which remounts this
  // hook with wasKicked=false.
  const realtime = useMeetingSocket(
    data && !data.wasKicked ? slug : null,
    data?.participant.id ?? null,
  );
  const isLocked = (data?.meeting.isLocked ?? false) || realtime.isLocked;
  const isEnded = data?.meeting.status === 'ENDED' || realtime.isEnded;

  // Carry the user's pre-join mic/camera intent into the room. Stored
  // by the pre-join page right before navigating. Read with `useMemo` so
  // the values are captured at first render and don't flip mid-session.
  const initialMedia = useMemo(() => {
    if (typeof window === 'undefined') {
      return { mic: false, camera: false };
    }
    return {
      mic: window.localStorage.getItem('meetino:prejoin:mic') === 'on',
      camera: window.localStorage.getItem('meetino:prejoin:camera') === 'on',
    };
  }, []);

  // Phase 6 LiveKit — gated on identity + ended/kicked.
  const livekit = useLivekitRoom(
    data && !isEnded && !realtime.wasKicked ? slug : null,
    !!data && !isEnded && !realtime.wasKicked,
    {
      initialMicEnabled: initialMedia.mic,
      initialCameraEnabled: initialMedia.camera,
      onMediaChange: (kind, enabled) => {
        if (kind === 'mic') realtime.toggleMic(enabled);
        else realtime.toggleCamera(enabled);
      },
    },
  );

  // Phase 7.6 — local recording (client-side only; no server uploads).
  const recorder = useLocalRecorder({ meetingSlug: slug });

  // Phase 7.7 — camera effects. We feed the local camera track into the
  // hook so the processor follows track changes (toggle off + on, device
  // swap). The hook itself handles SSR-safety + capability detection.
  const cameraEffects = useCameraEffects({
    videoTrack: (livekit.local?.videoTrack as LocalVideoTrack | null) ?? null,
    enabled: livekit.status === 'connected',
  });

  // Drawer state
  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  // Used to badge the toolbar when new files arrive while the panel is closed.
  const filesSnapshotForBadge = useMeetingFiles(
    data && !data.wasKicked ? slug : null,
    realtime.socket,
  );
  const [filesSeenCount, setFilesSeenCount] = useState(0);
  useEffect(() => {
    if (filesOpen) setFilesSeenCount(filesSnapshotForBadge.files.length);
  }, [filesOpen, filesSnapshotForBadge.files.length]);
  const [unreadChat, setUnreadChat] = useState(0);
  const lastReadCount = useMemo(() => realtime.messages.length, [chatOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (chatOpen) {
      setUnreadChat(0);
    } else {
      const delta = realtime.messages.length - lastReadCount;
      if (delta > 0) setUnreadChat(delta);
    }
  }, [realtime.messages.length, chatOpen, lastReadCount]);

  // Force-disconnect LiveKit on kick / end. Also finalize any recording in
  // flight so the user gets their file before the page swaps to the
  // kicked/ended screen.
  useEffect(() => {
    if (realtime.wasKicked || realtime.isEnded) {
      void recorder.finalizeIfRecording();
      livekit.leave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtime.wasKicked, realtime.isEnded]);

  // Phase 7.6 — once the host approves a rejoin, the kicked user must
  // re-initialize their gateway socket AND their LiveKit room with a
  // fresh token. Since the kicked socket was rejected at handshake by
  // socket-auth (defense in depth), a partial refetch isn't enough —
  // we need a clean mount. The simplest reliable way is a hard reload.
  //
  // This effect fires when the WS path delivers the approval (rare —
  // usually the kicked socket can't even connect to receive it). The
  // KickedRejoinScreen's own polling fallback handles the common case.
  useEffect(() => {
    if (realtime.myRejoinDecision !== 'APPROVED') return;
    if (typeof window !== 'undefined') window.location.reload();
  }, [realtime.myRejoinDecision]);

  // Kick confirm state for hosts.
  const [kickTarget, setKickTarget] = useState<ParticipantState | null>(null);
  const [kickError, setKickError] = useState<string | null>(null);
  const [kickBusy, setKickBusy] = useState(false);

  const performKick = async () => {
    if (!kickTarget) return;
    setKickBusy(true);
    setKickError(null);
    try {
      await apiClient.post(
        `/meetings/${slug}/participants/${kickTarget.participantId}/kick`,
        undefined,
      );
      setKickTarget(null);
    } catch (err) {
      setKickError(err instanceof ApiError ? err.message : 'حذف شرکت‌کننده با خطا مواجه شد.');
    } finally {
      setKickBusy(false);
    }
  };

  const leaveAndExit = async () => {
    // Stop + save the recording first so the user's file isn't lost.
    await recorder.finalizeIfRecording();
    livekit.leave();
    realtime.leave();
    router.push(data?.participant.type === 'REGISTERED' ? '/dashboard' : '/');
  };

  // ── Render branches ────────────────────────────────────────────────

  if (error) {
    return (
      <FullScreenMessage tone="error">
        <Alert variant="error">{error}</Alert>
        <div className="mt-6 text-center">
          <Link href={`/m/${slug}/prejoin`} className="text-sm text-brand-200 hover:text-white">
            بازگشت به صفحه پیش‌ورود
          </Link>
        </div>
      </FullScreenMessage>
    );
  }

  if (!data) {
    return (
      <FullScreenMessage>
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white"
          aria-label="در حال بارگذاری"
        />
      </FullScreenMessage>
    );
  }

  const { meeting, participant, isHost } = data;

  if (realtime.wasKicked || data.wasKicked) {
    return (
      <KickedRejoinScreen
        slug={slug}
        initialPendingRequestId={data.pendingRejoinRequestId}
        decision={realtime.myRejoinDecision}
        onLeave={() => router.push(participant.type === 'REGISTERED' ? '/dashboard' : '/')}
      />
    );
  }
  if (isEnded) {
    return (
      <EndedScreen
        autoEnded={meeting.autoEndedReason === 'EMPTY_TIMEOUT'}
        onLeave={() => router.push(participant.type === 'REGISTERED' ? '/dashboard' : '/')}
      />
    );
  }

  const micEnabled = livekit.local?.micEnabled ?? false;
  const cameraEnabled = livekit.local?.cameraEnabled ?? false;
  const screenShareEnabled = livekit.isScreenSharing;
  const controlsDisabled =
    realtime.status !== ConnectionStatus.CONNECTED || livekit.status !== 'connected';

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* ── Slim header ──────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/5 bg-slate-900/70 px-3 py-2.5 backdrop-blur sm:px-5 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Logo />
          <span className="hidden h-5 w-px bg-white/10 sm:block" />
          {/* Title — always visible (truncated on mobile). Host info hides on
              small screens to keep the bar single-line. */}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{meeting.title}</p>
            <p className="hidden truncate text-[11px] text-white/60 md:block">
              میزبان: {meeting.hostDisplayName}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ElapsedClock startedAt={meeting.startedAt} />
          {isLocked && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-200 ring-1 ring-inset ring-amber-400/30 sm:text-xs">
              <LockKeyhole className="h-3.5 w-3.5" />
              قفل
            </span>
          )}
          {/* Connection pills carry detail; collapse to plain dots on mobile. */}
          <div className="hidden items-center gap-2 md:flex">
            <ConnectionPill
              label="چت/حضور"
              tone={
                realtime.status === ConnectionStatus.CONNECTED
                  ? 'live'
                  : realtime.status === ConnectionStatus.ERROR
                    ? 'error'
                    : 'pending'
              }
            />
            <ConnectionPill
              label="تصویر/صدا"
              tone={
                livekit.status === 'connected'
                  ? 'live'
                  : livekit.status === 'error'
                    ? 'error'
                    : 'pending'
              }
            />
          </div>
        </div>
      </header>

      {/* ── Stage + right panel ──────────────────────────────────── */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {(realtime.error ||
            realtime.lastKickedOther ||
            livekit.permissionError ||
            livekit.error ||
            recorder.errorMessage ||
            recorder.status === 'recording') && (
            <div className="space-y-2 px-4 pt-3 sm:px-6">
              {realtime.error && <Alert variant="error">{realtime.error.message}</Alert>}
              {realtime.lastKickedOther && (
                <Alert variant="info" onDismiss={realtime.clearKickNotice}>
                  {t.room.kickedOther(realtime.lastKickedOther.displayName)}
                </Alert>
              )}
              {livekit.permissionError && (
                <Alert
                  variant="error"
                  onDismiss={livekit.clearPermissionError}
                >
                  {livekit.permissionError.message}
                </Alert>
              )}
              {livekit.error && (
                <Alert variant="error" onDismiss={livekit.clearError}>
                  {livekit.error}
                </Alert>
              )}
              {recorder.errorMessage && (
                <Alert variant="error">{recorder.errorMessage}</Alert>
              )}
              {recorder.status === 'recording' && (
                <Alert variant="info">{t.recording.notice}</Alert>
              )}
            </div>
          )}

          {/* Stage takes whatever height is left after the alerts above. */}
          <div className="relative min-h-0 flex-1">
            <VideoGrid
              local={livekit.local}
              remotes={livekit.remotes}
              status={livekit.status}
            />
            {/* Phase 7.7 — whiteboard overlays the stage so video keeps
                rendering underneath (closing the panel reveals it instantly). */}
            <WhiteboardPanel
              open={whiteboardOpen}
              onClose={() => setWhiteboardOpen(false)}
              socket={realtime.socket}
              participantId={participant.id}
            />
          </div>
        </main>

        {/* Desktop side panel slot — when one is open, take its width */}
        {(chatOpen || participantsOpen || filesOpen) && (
          <div className="hidden w-[26rem] shrink-0 border-s border-white/5 bg-slate-50 dark:bg-slate-900 lg:flex lg:flex-col">
            {participantsOpen && (
              <SidePanel
                open={participantsOpen}
                title="شرکت‌کنندگان"
                subtitle={`${realtime.participants.length} نفر آنلاین`}
                onClose={() => setParticipantsOpen(false)}
              >
                <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
                  {isHost && (
                    <HostControlsPanel
                      slug={slug}
                      isLocked={isLocked}
                      hasPassword={meeting.hasPassword}
                      isEnded={isEnded}
                      onEnded={() => router.push('/dashboard')}
                    />
                  )}
                  <ParticipantList
                    participants={realtime.participants}
                    meId={participant.id}
                    canKick={isHost}
                    onKick={(p) => setKickTarget(p)}
                  />
                </div>
              </SidePanel>
            )}
            {chatOpen && (
              <SidePanel
                open={chatOpen}
                title="چت جلسه"
                onClose={() => setChatOpen(false)}
              >
                <div className="flex h-full flex-col">
                  <ChatPanel
                    messages={realtime.messages}
                    meId={participant.id}
                    isHistoryLoading={realtime.isHistoryLoading}
                    status={realtime.status}
                    chatError={realtime.chatError}
                    onSend={realtime.sendChat}
                    onClearError={realtime.clearChatError}
                  />
                </div>
              </SidePanel>
            )}
            {filesOpen && (
              <SidePanel open title={t.files.title} onClose={() => setFilesOpen(false)}>
                <FilesPanel
                  slug={slug}
                  socket={realtime.socket}
                  meParticipantId={participant.id}
                  isHost={isHost}
                />
              </SidePanel>
            )}
          </div>
        )}
      </div>

      {/* Mobile overlay panels (only render the open one) */}
      <div className="lg:hidden">
        {participantsOpen && (
          <SidePanel
            open
            title="شرکت‌کنندگان"
            subtitle={`${realtime.participants.length} نفر آنلاین`}
            onClose={() => setParticipantsOpen(false)}
          >
            <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
              {isHost && (
                <HostControlsPanel
                  slug={slug}
                  isLocked={isLocked}
                  hasPassword={meeting.hasPassword}
                  isEnded={isEnded}
                  onEnded={() => router.push('/dashboard')}
                />
              )}
              <ParticipantList
                participants={realtime.participants}
                meId={participant.id}
                canKick={isHost}
                onKick={(p) => setKickTarget(p)}
              />
            </div>
          </SidePanel>
        )}
        {chatOpen && (
          <SidePanel open title="چت جلسه" onClose={() => setChatOpen(false)}>
            <div className="flex h-full flex-col">
              <ChatPanel
                messages={realtime.messages}
                meId={participant.id}
                isHistoryLoading={realtime.isHistoryLoading}
                status={realtime.status}
                chatError={realtime.chatError}
                onSend={realtime.sendChat}
                onClearError={realtime.clearChatError}
              />
            </div>
          </SidePanel>
        )}
        {filesOpen && (
          <SidePanel open title={t.files.title} onClose={() => setFilesOpen(false)}>
            <FilesPanel slug={slug} socket={realtime.socket} />
          </SidePanel>
        )}
      </div>

      {/* ── Fixed toolbar ────────────────────────────────────────── */}
      <MeetingToolbar
        meetingTitle={meeting.title}
        meetingTimeLabel={meeting.hostDisplayName ? `میزبان: ${meeting.hostDisplayName}` : undefined}
        micEnabled={micEnabled}
        cameraEnabled={cameraEnabled}
        screenShareEnabled={screenShareEnabled}
        disabled={controlsDisabled}
        onToggleMic={livekit.toggleMic}
        onToggleCamera={livekit.toggleCamera}
        onToggleScreenShare={livekit.toggleScreenShare}
        onLeave={() => void leaveAndExit()}
        extraRight={<RecordingButton recorder={recorder} hideOnMobile />}
        cameraEffectsSlot={<CameraEffectsButton effects={cameraEffects} />}
        whiteboardOpen={whiteboardOpen}
        onToggleWhiteboard={() => setWhiteboardOpen((v) => !v)}
        filesOpen={filesOpen}
        onToggleFiles={() => {
          setFilesOpen((v) => !v);
          if (!filesOpen) {
            setChatOpen(false);
            setParticipantsOpen(false);
          }
        }}
        filesCount={
          filesSnapshotForBadge.files.length - filesSeenCount > 0
            ? filesSnapshotForBadge.files.length - filesSeenCount
            : undefined
        }
        participantCount={realtime.participants.length}
        unreadChat={unreadChat}
        participantsOpen={participantsOpen}
        chatOpen={chatOpen}
        onToggleParticipants={() => {
          setParticipantsOpen((v) => !v);
          if (!participantsOpen) {
            setChatOpen(false);
            setFilesOpen(false);
          }
        }}
        onToggleChat={() => {
          setChatOpen((v) => !v);
          if (!chatOpen) {
            setParticipantsOpen(false);
            setFilesOpen(false);
          }
        }}
      />

      {/* Phase 7.6 — host-side rejoin approval prompts */}
      {isHost && (
        <RejoinRequestsToast
          slug={slug}
          requests={realtime.rejoinRequests}
          onDismiss={realtime.dismissRejoinRequest}
        />
      )}

      {/* Kick confirmation */}
      <ConfirmDialog
        open={!!kickTarget}
        title="حذف شرکت‌کننده"
        message={
          kickTarget
            ? `آیا «${kickTarget.displayName}» را از جلسه حذف می‌کنید؟ این فرد دیگر نمی‌تواند با همین لینک یا نشست مهمان وارد شود.${
                kickError ? `\n\n${kickError}` : ''
              }`
            : ''
        }
        confirmLabel="بله، حذف کن"
        destructive
        busy={kickBusy}
        onConfirm={performKick}
        onCancel={() => {
          if (!kickBusy) {
            setKickTarget(null);
            setKickError(null);
          }
        }}
      />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

/**
 * Tiny live-updating "how long has the meeting been running" pill.
 * Anchored to `meeting.startedAt`; renders MM:SS or HH:MM:SS.
 */
function ElapsedClock({ startedAt }: { startedAt: string | null }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!startedAt) return null;
  const totalSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
  );
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const label =
    h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium tabular-nums text-white/90"
      aria-label={`زمان جلسه ${label}`}
      title={`زمان جلسه ${label}`}
    >
      <Clock className="h-3.5 w-3.5 text-white/60" aria-hidden="true" />
      {label}
    </span>
  );
}

function ConnectionPill({
  label,
  tone,
}: {
  label: string;
  tone: 'live' | 'pending' | 'error';
}) {
  const map = {
    live: 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/30',
    pending: 'bg-amber-500/15 text-amber-200 ring-amber-400/30',
    error: 'bg-rose-500/15 text-rose-200 ring-rose-400/30',
  } as const;
  const dot = {
    live: 'bg-emerald-400',
    pending: 'bg-amber-400 animate-pulse',
    error: 'bg-rose-400',
  } as const;
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset',
        map[tone],
      ].join(' ')}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot[tone]}`} aria-hidden />
      {label}
    </span>
  );
}

function FullScreenMessage({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'error';
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        'grid min-h-screen w-screen place-items-center px-6 text-center',
        tone === 'error' ? 'bg-slate-950 text-rose-200' : 'bg-slate-950 text-slate-100',
      ].join(' ')}
    >
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

function EndedScreen({
  onLeave,
  autoEnded = false,
}: {
  onLeave: () => void;
  autoEnded?: boolean;
}) {
  return (
    <div className="grid min-h-screen w-screen place-items-center bg-slate-950 px-6 text-center text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/15 text-3xl">
          🎬
        </div>
        <h1 className="mt-4 text-xl font-bold">جلسه پایان یافت</h1>
        <p className="mt-2 text-sm leading-7 text-slate-300">
          {autoEnded
            ? t.autoEnd.banner
            : 'این جلسه توسط میزبان پایان داده شده است. می‌توانید بعداً یک جلسهٔ جدید شروع کنید.'}
        </p>
        <div className="mt-6">
          <Button onClick={onLeave}>خروج</Button>
        </div>
      </div>
    </div>
  );
}
