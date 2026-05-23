'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioPresets,
  ConnectionState,
  LocalParticipant,
  type Participant,
  Room,
  RoomEvent,
  Track,
  type TrackPublication,
} from 'livekit-client';
import type {
  LivekitParticipantMetadata,
  LivekitTokenResponse,
  ParticipantRole,
  ParticipantType,
} from '@meetino/shared';
import { apiClient, ApiError } from '@/lib/api-client';

// ── Public types ────────────────────────────────────────────────────

export type LivekitStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export type MediaDevice = 'camera' | 'microphone' | 'screen';

export interface LivekitPermissionError {
  device: MediaDevice;
  message: string;
}

/**
 * Render-friendly snapshot of a participant. The raw livekit-client Track
 * objects are kept on the snapshot so tiles can call `track.attach()` on
 * a <video>/<audio> element directly.
 */
export interface LivekitParticipantSnapshot {
  sid: string;
  identity: string;
  /** Decoded from LiveKit metadata; falls back to .name / .identity. */
  displayName: string;
  role: ParticipantRole | null;
  type: ParticipantType | null;
  isLocal: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  isSpeaking: boolean;
  videoTrack: Track | null;
  audioTrack: Track | null;
  screenTrack: Track | null;
}

export interface LivekitRoomState {
  status: LivekitStatus;
  error: string | null;
  permissionError: LivekitPermissionError | null;
  /** The local participant; null until connected. */
  local: LivekitParticipantSnapshot | null;
  /** Remote participants currently in the room. */
  remotes: LivekitParticipantSnapshot[];
  isScreenSharing: boolean;
  toggleMic: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  /** Detach all tracks and close the connection. */
  leave: () => void;
  clearError: () => void;
  clearPermissionError: () => void;
}

export interface UseLivekitOptions {
  /**
   * Called when the local mic or camera publication flips. Used to mirror
   * the change to Phase 4's WS advisory flag so peers see the right chip
   * in the participant list.
   */
  onMediaChange?: (kind: 'mic' | 'camera', enabled: boolean) => void;
  /**
   * If true, the hook auto-publishes the microphone as soon as the room
   * reaches the `connected` state. Use this to carry the user's pre-join
   * intent across the page navigation. Honored exactly once per connection.
   */
  initialMicEnabled?: boolean;
  /** Same as {@link initialMicEnabled} but for the camera. */
  initialCameraEnabled?: boolean;
}

// ── Hook ────────────────────────────────────────────────────────────

/**
 * Connect to LiveKit for the given meeting slug once `enabled` flips true.
 * The connect happens without publishing any tracks; calling toggleMic /
 * toggleCamera is what actually prompts the browser for device access.
 */
export function useLivekitRoom(
  slug: string | null,
  enabled: boolean,
  opts: UseLivekitOptions = {},
): LivekitRoomState {
  const [status, setStatus] = useState<LivekitStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<LivekitPermissionError | null>(null);
  const [local, setLocal] = useState<LivekitParticipantSnapshot | null>(null);
  const [remotes, setRemotes] = useState<LivekitParticipantSnapshot[]>([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const onMediaChangeRef = useRef(opts.onMediaChange);
  onMediaChangeRef.current = opts.onMediaChange;
  // Latch the user's pre-join intent — read once on mount and apply exactly
  // once per connection. We don't react to changes mid-meeting; subsequent
  // toggling goes through the explicit buttons in the UI.
  const initialMicRef = useRef(!!opts.initialMicEnabled);
  const initialCameraRef = useRef(!!opts.initialCameraEnabled);
  // Flips true after we've auto-applied the intent for the current room.
  const appliedInitialRef = useRef(false);

  /**
   * Honor the pre-join mic/camera intent right after the LiveKit room
   * reaches the connected state. Errors are mapped through the same
   * permission handler as manual toggles so the UI gets a clean message
   * if the browser blocks media (e.g. permission revoked between pages).
   */
  const applyInitialMedia = useCallback(
    async (room: Room, wantMic: boolean, wantCam: boolean) => {
      const lp = room.localParticipant;
      try {
        if (wantMic && !lp.isMicrophoneEnabled) {
          await lp.setMicrophoneEnabled(true);
          onMediaChangeRef.current?.('mic', true);
        }
      } catch (err) {
        handleMediaError('microphone', err, setPermissionError, setError);
      }
      try {
        if (wantCam && !lp.isCameraEnabled) {
          await lp.setCameraEnabled(true);
          onMediaChangeRef.current?.('camera', true);
        }
      } catch (err) {
        handleMediaError('camera', err, setPermissionError, setError);
      }
    },
    [],
  );

  // ── Lifecycle ────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug || !enabled) return;
    setStatus('connecting');
    setError(null);

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      // Voice quality: enable browser-side DSP and ask for 48 kHz mono so
      // Opus has clean input to work with. Without these the user's own
      // mic captures speaker output + room noise → muddy audio for peers.
      audioCaptureDefaults: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48_000,
        channelCount: 1,
      },
      // Publish at the "music" preset (48 kbps Opus). Plenty for human voice
      // while staying well under typical bandwidth limits, and FEC ("red")
      // keeps it intelligible under packet loss.
      publishDefaults: {
        audioPreset: AudioPresets.music,
        red: true,
        dtx: true,
      },
    });
    roomRef.current = room;

    // Single refresh function — recompute the snapshots whenever anything
    // about a participant or track changes. Cheap and keeps the React
    // tree in sync with livekit-client's internal state.
    const refresh = () => {
      setLocal(room.localParticipant ? snapshot(room.localParticipant) : null);
      setRemotes(Array.from(room.remoteParticipants.values()).map(snapshot));
      setIsScreenSharing(
        !!getPublication(room.localParticipant, Track.Source.ScreenShare)?.track,
      );
    };

    const onConnState = (state: ConnectionState) => {
      switch (state) {
        case ConnectionState.Connecting:
          setStatus('connecting');
          break;
        case ConnectionState.Connected:
          setStatus('connected');
          refresh();
          // Apply the user's pre-join intent — once per room.
          if (!appliedInitialRef.current) {
            appliedInitialRef.current = true;
            void applyInitialMedia(room, initialMicRef.current, initialCameraRef.current);
          }
          break;
        case ConnectionState.Reconnecting:
          setStatus('reconnecting');
          break;
        case ConnectionState.Disconnected:
          setStatus('disconnected');
          break;
      }
    };

    // Wire up every event that should cause a re-render. Keeping the list
    // explicit (vs. dynamic) lets the cleanup be a mirror image.
    room
      .on(RoomEvent.ConnectionStateChanged, onConnState)
      .on(RoomEvent.ParticipantConnected, refresh)
      .on(RoomEvent.ParticipantDisconnected, refresh)
      .on(RoomEvent.TrackSubscribed, refresh)
      .on(RoomEvent.TrackUnsubscribed, refresh)
      .on(RoomEvent.TrackPublished, refresh)
      .on(RoomEvent.TrackUnpublished, refresh)
      .on(RoomEvent.TrackMuted, refresh)
      .on(RoomEvent.TrackUnmuted, refresh)
      .on(RoomEvent.LocalTrackPublished, refresh)
      .on(RoomEvent.LocalTrackUnpublished, refresh)
      .on(RoomEvent.ActiveSpeakersChanged, refresh)
      .on(RoomEvent.ParticipantMetadataChanged, refresh)
      .on(RoomEvent.ParticipantNameChanged, refresh);

    // Bootstrap: get a token, then connect.
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.post<LivekitTokenResponse>(
          `/meetings/${slug}/livekit-token`,
          undefined,
        );
        if (cancelled) return;
        await room.connect(data.url, data.token, { autoSubscribe: true });
        if (cancelled) {
          await room.disconnect();
          return;
        }
        refresh();
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setError(
          err instanceof ApiError
            ? err.message
            : (err as Error)?.message || 'اتصال به سرور ویدیو با خطا مواجه شد.',
        );
      }
    })();

    return () => {
      cancelled = true;
      room
        .off(RoomEvent.ConnectionStateChanged, onConnState)
        .off(RoomEvent.ParticipantConnected, refresh)
        .off(RoomEvent.ParticipantDisconnected, refresh)
        .off(RoomEvent.TrackSubscribed, refresh)
        .off(RoomEvent.TrackUnsubscribed, refresh)
        .off(RoomEvent.TrackPublished, refresh)
        .off(RoomEvent.TrackUnpublished, refresh)
        .off(RoomEvent.TrackMuted, refresh)
        .off(RoomEvent.TrackUnmuted, refresh)
        .off(RoomEvent.LocalTrackPublished, refresh)
        .off(RoomEvent.LocalTrackUnpublished, refresh)
        .off(RoomEvent.ActiveSpeakersChanged, refresh)
        .off(RoomEvent.ParticipantMetadataChanged, refresh)
        .off(RoomEvent.ParticipantNameChanged, refresh);

      room.disconnect().catch(() => {
        // Already disconnected — ignore.
      });
      roomRef.current = null;
      // Allow the initial-media intent to re-apply if we reconnect.
      appliedInitialRef.current = false;
    };
  }, [slug, enabled]);

  // ── Controls ─────────────────────────────────────────────────────

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    const lp = room.localParticipant;
    const next = !lp.isMicrophoneEnabled;
    try {
      await lp.setMicrophoneEnabled(next);
      onMediaChangeRef.current?.('mic', next);
    } catch (err) {
      handleMediaError('microphone', err, setPermissionError, setError);
    }
  }, []);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    const lp = room.localParticipant;
    const next = !lp.isCameraEnabled;
    try {
      await lp.setCameraEnabled(next);
      onMediaChangeRef.current?.('camera', next);
    } catch (err) {
      handleMediaError('camera', err, setPermissionError, setError);
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    const lp = room.localParticipant;
    const next = !lp.isScreenShareEnabled;
    try {
      await lp.setScreenShareEnabled(next);
    } catch (err) {
      handleMediaError('screen', err, setPermissionError, setError);
    }
  }, []);

  const leave = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    room.disconnect().catch(() => {
      /* noop */
    });
  }, []);

  const clearError = useCallback(() => setError(null), []);
  const clearPermissionError = useCallback(() => setPermissionError(null), []);

  return {
    status,
    error,
    permissionError,
    local,
    remotes,
    isScreenSharing,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    leave,
    clearError,
    clearPermissionError,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

function snapshot(p: Participant): LivekitParticipantSnapshot {
  const meta = parseMetadata(p.metadata);
  const camera = getPublication(p, Track.Source.Camera);
  const mic = getPublication(p, Track.Source.Microphone);
  const screen = getPublication(p, Track.Source.ScreenShare);

  return {
    sid: p.sid,
    identity: p.identity,
    displayName: meta?.displayName || p.name || p.identity,
    role: meta?.role ?? null,
    type: meta?.type ?? null,
    isLocal: p instanceof LocalParticipant,
    micEnabled: !!mic?.track && !mic.isMuted,
    cameraEnabled: !!camera?.track && !camera.isMuted,
    isSpeaking: p.isSpeaking,
    videoTrack: camera?.track ?? null,
    audioTrack: mic?.track ?? null,
    screenTrack: screen?.track ?? null,
  };
}

function getPublication(
  p: Participant | undefined | null,
  source: Track.Source,
): TrackPublication | undefined {
  if (!p) return undefined;
  return p.getTrackPublication(source);
}

function parseMetadata(raw: string | undefined): LivekitParticipantMetadata | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LivekitParticipantMetadata;
  } catch {
    return null;
  }
}

/**
 * Translate getUserMedia DOMException / LiveKit errors into a UI-ready
 * Persian message. Genuine permission denials surface as permissionError
 * so the UI can render a focused notice; other failures fall back to the
 * generic error banner.
 */
function handleMediaError(
  device: MediaDevice,
  err: unknown,
  setPermission: (e: LivekitPermissionError | null) => void,
  setGeneral: (e: string | null) => void,
): void {
  const name = (err as { name?: string })?.name ?? '';
  const message = (err as Error)?.message ?? '';

  if (name === 'NotAllowedError' || /permission denied/i.test(message)) {
    setPermission({
      device,
      message:
        device === 'camera'
          ? 'دسترسی به دوربین رد شد. می‌توانید بدون دوربین در جلسه بمانید.'
          : device === 'microphone'
            ? 'دسترسی به میکروفون رد شد. می‌توانید بدون میکروفون در جلسه بمانید.'
            : 'دسترسی به اشتراک‌گذاری صفحه رد شد.',
    });
    return;
  }
  if (name === 'NotFoundError') {
    setPermission({
      device,
      message:
        device === 'camera'
          ? 'دوربینی یافت نشد.'
          : device === 'microphone'
            ? 'میکروفونی یافت نشد.'
            : 'منبع اشتراک‌گذاری پیدا نشد.',
    });
    return;
  }
  if (name === 'NotReadableError') {
    setPermission({
      device,
      message: 'دستگاه توسط برنامهٔ دیگری استفاده می‌شود.',
    });
    return;
  }
  setGeneral(message || 'خطا در تنظیم دستگاه');
}
