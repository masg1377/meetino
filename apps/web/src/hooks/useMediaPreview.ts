'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export type MediaPermissionState =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'not-found'
  | 'error';

export interface MediaPreviewState {
  /** Bound to a <video> element to render the preview. */
  stream: MediaStream | null;
  status: MediaPermissionState;
  errorMessage: string | null;
  /** Whether the user currently wants their camera on. */
  cameraEnabled: boolean;
  /** Whether the user currently wants their microphone on. */
  micEnabled: boolean;
  toggleCamera: () => Promise<void>;
  toggleMic: () => Promise<void>;
  /** Request both at once — used by the "ready to join" CTA. */
  request: () => Promise<void>;
  /** Stop all tracks and detach from any video element. */
  stop: () => void;
}

/**
 * Pre-join camera + microphone preview. Lives entirely on the page that
 * mounts it — it does NOT touch LiveKit. The user's mic/cam intent is
 * stored in localStorage so the room can read it on the next page.
 *
 * Persisted keys:
 *   - meetino:prejoin:mic     = "on" | "off"
 *   - meetino:prejoin:camera  = "on" | "off"
 */
export function useMediaPreview(): MediaPreviewState {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<MediaPermissionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState<boolean>(() =>
    typeof window === 'undefined'
      ? true
      : window.localStorage.getItem('meetino:prejoin:camera') !== 'off',
  );
  const [micEnabled, setMicEnabled] = useState<boolean>(() =>
    typeof window === 'undefined'
      ? true
      : window.localStorage.getItem('meetino:prejoin:mic') !== 'off',
  );

  const streamRef = useRef<MediaStream | null>(null);
  streamRef.current = stream;

  const setPersist = (key: 'mic' | 'camera', enabled: boolean) => {
    try {
      window.localStorage.setItem(`meetino:prejoin:${key}`, enabled ? 'on' : 'off');
    } catch {
      // ignore (private mode etc.)
    }
  };

  /** Acquire a fresh stream matching current toggle state. */
  const acquire = useCallback(
    async (wantCam: boolean, wantMic: boolean): Promise<MediaStream | null> => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
        setStatus('error');
        setErrorMessage('مرورگر شما از دسترسی به دوربین و میکروفون پشتیبانی نمی‌کند.');
        return null;
      }
      if (!wantCam && !wantMic) {
        return null;
      }
      try {
        setStatus('requesting');
        setErrorMessage(null);
        const next = await navigator.mediaDevices.getUserMedia({
          video: wantCam ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
          audio: wantMic,
        });
        setStatus('granted');
        return next;
      } catch (err) {
        const name = (err as { name?: string })?.name ?? '';
        if (name === 'NotAllowedError') {
          setStatus('denied');
          setErrorMessage('دسترسی به دوربین/میکروفون رد شد. می‌توانید بدون آن‌ها وارد جلسه شوید.');
        } else if (name === 'NotFoundError') {
          setStatus('not-found');
          setErrorMessage('دوربین یا میکروفونی پیدا نشد.');
        } else {
          setStatus('error');
          setErrorMessage((err as Error).message || 'خطایی در دسترسی به سخت‌افزار رخ داد.');
        }
        return null;
      }
    },
    [],
  );

  /** Stop and replace the active stream. */
  const replaceStream = useCallback((next: MediaStream | null) => {
    setStream((prev) => {
      if (prev) prev.getTracks().forEach((t) => t.stop());
      return next;
    });
  }, []);

  // Auto-request once on mount with the user's last preferences.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await acquire(cameraEnabled, micEnabled);
      if (cancelled) {
        next?.getTracks().forEach((t) => t.stop());
        return;
      }
      replaceStream(next);
    })();
    return () => {
      cancelled = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // Intentionally only run on mount — toggles re-acquire via their handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCamera = useCallback(async () => {
    const next = !cameraEnabled;
    setCameraEnabled(next);
    setPersist('camera', next);
    const nextStream = await acquire(next, micEnabled);
    replaceStream(nextStream);
  }, [cameraEnabled, micEnabled, acquire, replaceStream]);

  const toggleMic = useCallback(async () => {
    const next = !micEnabled;
    setMicEnabled(next);
    setPersist('mic', next);
    const nextStream = await acquire(cameraEnabled, next);
    replaceStream(nextStream);
  }, [cameraEnabled, micEnabled, acquire, replaceStream]);

  const request = useCallback(async () => {
    const next = await acquire(cameraEnabled, micEnabled);
    replaceStream(next);
  }, [cameraEnabled, micEnabled, acquire, replaceStream]);

  const stop = useCallback(() => {
    replaceStream(null);
    setStatus('idle');
  }, [replaceStream]);

  return {
    stream,
    status,
    errorMessage,
    cameraEnabled,
    micEnabled,
    toggleCamera,
    toggleMic,
    request,
    stop,
  };
}
