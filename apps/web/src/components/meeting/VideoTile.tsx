'use client';
import { useEffect, useRef } from 'react';
import { Track } from 'livekit-client';
import type { LivekitParticipantSnapshot } from '@/hooks/useLivekitRoom';
import type { ParticipantRole } from '@meetino/shared';

interface Props {
  participant: LivekitParticipantSnapshot;
  /** Render the screen-share track instead of the camera. */
  asScreenShare?: boolean;
}

const ROLE_LABEL: Record<ParticipantRole, string> = {
  HOST: 'میزبان',
  STUDENT: 'شرکت‌کننده',
  GUEST: 'مهمان',
};

/**
 * Renders one participant's video tile. Attaches the LiveKit track to the
 * underlying <video> element on mount and detaches on unmount. Audio for
 * remote participants is attached to a hidden <audio> element so users
 * can hear them even when off-screen.
 */
export function VideoTile({ participant, asScreenShare = false }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const videoTrack: Track | null = asScreenShare
    ? participant.screenTrack
    : participant.videoTrack;
  const audioTrack: Track | null = participant.audioTrack;

  // Attach video track
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoTrack) return;
    videoTrack.attach(el);
    return () => {
      videoTrack.detach(el);
    };
  }, [videoTrack]);

  // Attach audio track (skipped for local — would create an echo loop).
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audioTrack || participant.isLocal) return;
    audioTrack.attach(el);
    return () => {
      audioTrack.detach(el);
    };
  }, [audioTrack, participant.isLocal]);

  const initial = participant.displayName.trim().charAt(0).toUpperCase() || '؟';

  return (
    <div
      className={[
        // Fill whatever cell the grid gives us — the parent (VideoGrid) is
        // responsible for sizing/aspect-ratio so the stage can never overflow.
        // `ring-inset` keeps the speaker indicator visible regardless of any
        // parent overflow-hidden — outset rings get clipped on the corners.
        'relative h-full w-full overflow-hidden rounded-2xl bg-slate-900 shadow-sm ring-1 ring-inset',
        participant.isSpeaking
          ? 'ring-[3px] ring-inset ring-emerald-400'
          : 'ring-slate-800',
      ].join(' ')}
      aria-label={participant.displayName}
    >
      {videoTrack ? (
        <video
          ref={videoRef}
          // Mirror the local camera so it feels like a mirror, not a webcam preview.
          className={[
            'h-full w-full object-cover',
            participant.isLocal && !asScreenShare ? 'scale-x-[-1]' : '',
          ].join(' ')}
          autoPlay
          playsInline
          muted={participant.isLocal || asScreenShare /* hear remote audio via the audio element only */}
        />
      ) : (
        // No camera — show an avatar with initial
        <div className="grid h-full w-full place-items-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-slate-700 text-3xl font-semibold text-white">
            {initial}
          </div>
        </div>
      )}

      {/* Audio sink — invisible, only used for remote participants. */}
      {!participant.isLocal && !asScreenShare && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio ref={audioRef} autoPlay />
      )}

      {/* Footer overlay: name + role + mic state */}
      <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded-xl bg-black/55 px-3 py-1.5 text-xs text-white backdrop-blur-sm">
        <span className="flex items-center gap-2 truncate">
          <span className="truncate font-medium">
            {participant.displayName}
            {participant.isLocal && <span className="text-white/70"> (شما)</span>}
            {asScreenShare && <span className="text-white/70"> · اشتراک صفحه</span>}
          </span>
          {participant.role && (
            <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">
              {ROLE_LABEL[participant.role]}
            </span>
          )}
        </span>
        <span aria-label={participant.micEnabled ? 'میکروفون روشن' : 'میکروفون خاموش'}>
          {participant.micEnabled ? <MicOn /> : <MicOff />}
        </span>
      </div>
    </div>
  );
}

function MicOn() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
function MicOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-rose-300">
      <path d="M3 3l18 18M9 9v2a3 3 0 0 0 5.12 2.12M15 9V6a3 3 0 0 0-5.66-1.43" />
      <path d="M5 11a7 7 0 0 0 11.07 5.74M19 11a7 7 0 0 1-.21 1.74M12 18v3" />
    </svg>
  );
}
