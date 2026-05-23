'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '@/lib/i18n';
import {
  downloadBlob,
  extForMime,
  isoStampForFilename,
  isRecordingSupported,
  pickRecorderMimeType,
} from '@/lib/recording';

export type RecorderStatus =
  | 'idle'
  | 'preparing'
  | 'recording'
  | 'stopping'
  | 'stopped'
  | 'denied'
  | 'unsupported'
  | 'error';

export interface LocalRecorderState {
  status: RecorderStatus;
  /** Seconds since recording started; resets when a new recording starts. */
  elapsedSeconds: number;
  /** Persian-friendly label for the current status (toolbar / a11y). */
  statusLabel: string;
  /** Human error string, if status is 'error' / 'denied' / 'unsupported'. */
  errorMessage: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  /** Force-stop + finalize. Used by leave/kick/ended pipelines. */
  finalizeIfRecording: () => Promise<void>;
}

interface Options {
  /** Used inside the auto-downloaded filename: `meetino-<slug>-<stamp>.webm`. */
  meetingSlug: string;
  /** Called whenever a finished file has been pushed to the user. */
  onSaved?: (filename: string, blob: Blob) => void;
  /** Called when a recoverable error happens (denied/unsupported/io). */
  onError?: (message: string) => void;
}

/**
 * Client-side meeting recorder.
 *
 * Uses `navigator.mediaDevices.getDisplayMedia` to capture a tab / window /
 * full screen the user picks, plus optional audio (browser-dependent).
 * Output is muxed by `MediaRecorder` into a webm/mp4 Blob and downloaded
 * straight to the user's device. NOTHING is uploaded or shared with peers.
 *
 * Safety:
 *   - Never touches `navigator.mediaDevices` during SSR.
 *   - Cleans up all tracks when stopping, when the page unloads, and when
 *     the user revokes the picker.
 *   - If the user just closes the tab, we set up a `beforeunload` handler
 *     that calls `recorder.stop()` synchronously — most browsers will give
 *     us enough time to finalize the file and trigger the download.
 */
export function useLocalRecorder({
  meetingSlug,
  onSaved,
  onError,
}: Options): LocalRecorderState {
  const [status, setStatus] = useState<RecorderStatus>(() =>
    typeof window === 'undefined' || isRecordingSupported() ? 'idle' : 'unsupported',
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeRef = useRef<string>('');
  // Three concurrent streams we may own + an AudioContext mixing graph.
  // We keep them in refs so `cleanup()` can always reach the right objects.
  const screenStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mixedStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSavedRef = useRef(onSaved);
  const onErrorRef = useRef(onError);
  onSavedRef.current = onSaved;
  onErrorRef.current = onError;

  const cleanup = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;

    // Stop every track we ever held.
    [
      screenStreamRef.current,
      micStreamRef.current,
      mixedStreamRef.current,
    ].forEach((s) => {
      s?.getTracks().forEach((tr) => {
        try {
          tr.stop();
        } catch {
          // ignore
        }
      });
    });
    screenStreamRef.current = null;
    micStreamRef.current = null;
    mixedStreamRef.current = null;

    // Tear down the audio graph.
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {
        /* ignore */
      });
      audioCtxRef.current = null;
    }

    chunksRef.current = [];
    recorderRef.current = null;
  }, []);

  const reportError = useCallback((message: string, next: RecorderStatus = 'error') => {
    setStatus(next);
    setErrorMessage(message);
    onErrorRef.current?.(message);
    cleanup();
  }, [cleanup]);

  const start = useCallback(async () => {
    if (recorderRef.current) return; // already running
    if (!isRecordingSupported()) {
      reportError(t.recording.unsupported, 'unsupported');
      return;
    }

    setStatus('preparing');
    setErrorMessage(null);
    setElapsedSeconds(0);

    // 1) Screen capture (video + best-effort system/tab audio).
    let screenStream: MediaStream;
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
    } catch (err) {
      const name = (err as { name?: string })?.name ?? '';
      if (name === 'NotAllowedError') {
        reportError(t.recording.state.denied, 'denied');
      } else {
        reportError(t.recording.state.error, 'error');
      }
      return;
    }

    if (screenStream.getVideoTracks().length === 0) {
      screenStream.getTracks().forEach((tr) => tr.stop());
      reportError(t.recording.emptyError, 'error');
      return;
    }
    screenStreamRef.current = screenStream;

    // 2) Mic capture — best-effort. We never block recording if the mic
    //    is denied; we just record without it (a screen-only recording
    //    is still useful). Many browsers also fail to deliver system
    //    audio from getDisplayMedia, so the mic is the user's lifeline
    //    for voice-over.
    let micStream: MediaStream | null = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      micStreamRef.current = micStream;
    } catch {
      // Mic blocked / unavailable — proceed with whatever audio (if any)
      // the screen capture provided.
      micStream = null;
    }

    // 3) Build the stream we hand to MediaRecorder. If we have at least
    //    one audio source, we route everything through an AudioContext
    //    so the recorder sees a single, properly-mixed audio track.
    //    Otherwise we just take the screen video as-is.
    const screenAudioTracks = screenStream.getAudioTracks();
    const hasAnyAudio = screenAudioTracks.length > 0 || !!micStream;

    let mixedStream: MediaStream;
    if (hasAnyAudio) {
      let audioCtx: AudioContext;
      try {
        audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
      } catch {
        // No AudioContext available — fall back to just the screen stream.
        // At least the video will be recorded.
        mixedStream = screenStream;
        audioCtxRef.current = null;
        return finishStartWith(mixedStream);
      }

      const dest = audioCtx.createMediaStreamDestination();

      // Pipe screen / tab / system audio in (if any).
      if (screenAudioTracks.length > 0) {
        try {
          const src = audioCtx.createMediaStreamSource(
            new MediaStream(screenAudioTracks),
          );
          src.connect(dest);
        } catch {
          // ignore — some browsers refuse to pipe display-capture audio
        }
      }

      // Pipe mic audio in (if any).
      if (micStream && micStream.getAudioTracks().length > 0) {
        try {
          const src = audioCtx.createMediaStreamSource(micStream);
          src.connect(dest);
        } catch {
          // ignore
        }
      }

      mixedStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);
    } else {
      mixedStream = screenStream;
    }

    return finishStartWith(mixedStream);

    // ---------------------------------------------------------------
    // Inner helper — given the final stream, wire up MediaRecorder.
    // Kept as a closure so we can return early from the audio-graph
    // branch without duplicating this code.
    // ---------------------------------------------------------------
    function finishStartWith(finalStream: MediaStream) {
      mixedStreamRef.current = finalStream;

      const mime = pickRecorderMimeType();
      mimeRef.current = mime;

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(
          finalStream,
          mime ? { mimeType: mime } : undefined,
        );
      } catch {
        reportError(t.recording.state.error, 'error');
        return;
      }

      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      // When the user clicks the browser's "Stop sharing" pill, the
      // screen video track ends — treat that the same as a manual stop.
      screenStream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          if (recorderRef.current?.state === 'recording') {
            void stop();
          }
        });
      });

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeRef.current || 'video/webm',
        });
        const ext = extForMime(mimeRef.current || 'video/webm');
        const filename = `meetino-${meetingSlug}-${isoStampForFilename()}.${ext}`;
        try {
          if (blob.size > 0) {
            downloadBlob(blob, filename);
            onSavedRef.current?.(filename, blob);
          }
        } finally {
          cleanup();
          setStatus('stopped');
        }
      };

      recorder.onerror = () => {
        reportError(t.recording.state.error, 'error');
      };

      startedAtRef.current = Date.now();
      setStatus('recording');
      tickRef.current = setInterval(() => {
        setElapsedSeconds(
          Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)),
        );
      }, 1000);

      // Emit a chunk every second so a forced finalize still has data.
      recorder.start(1_000);
    }
  }, [meetingSlug, reportError, cleanup]);

  const stop = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state === 'inactive') {
      cleanup();
      setStatus('stopped');
      return;
    }
    setStatus('stopping');
    return new Promise<void>((resolve) => {
      const original = rec.onstop;
      rec.onstop = (ev) => {
        // Call our own handler (download + cleanup), then resolve.
        if (typeof original === 'function') (original as (e: Event) => void).call(rec, ev);
        resolve();
      };
      try {
        rec.stop();
      } catch {
        cleanup();
        setStatus('stopped');
        resolve();
      }
    });
  }, [cleanup]);

  const finalizeIfRecording = useCallback(async () => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      await stop();
    }
  }, [stop]);

  // Best-effort save when the tab is closing.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onBeforeUnload = () => {
      if (recorderRef.current?.state === 'recording') {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === 'recording') {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      cleanup();
    };
  }, [cleanup]);

  const statusLabel = (() => {
    switch (status) {
      case 'idle':
        return t.recording.state.idle;
      case 'preparing':
        return t.recording.btn.preparing;
      case 'recording':
        return t.recording.state.recording;
      case 'stopping':
        return t.recording.btn.preparing;
      case 'stopped':
        return t.recording.state.stopped;
      case 'denied':
        return t.recording.state.denied;
      case 'unsupported':
        return t.recording.unsupported;
      case 'error':
      default:
        return t.recording.state.error;
    }
  })();

  return {
    status,
    elapsedSeconds,
    statusLabel,
    errorMessage,
    start,
    stop,
    finalizeIfRecording,
  };
}
