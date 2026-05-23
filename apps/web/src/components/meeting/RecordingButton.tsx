'use client';
import { Circle, Disc3, Square } from 'lucide-react';
import { t } from '@/lib/i18n';
import type { LocalRecorderState } from '@/hooks/useLocalRecorder';

interface Props {
  recorder: LocalRecorderState;
  /** Hide the button on layouts that can't fit it (e.g. very narrow phones). */
  hideOnMobile?: boolean;
}

/**
 * Toolbar pill for client-side local recording. Three visible states:
 *   - idle / stopped / denied / unsupported / error → "ضبط"  (start)
 *   - preparing / stopping                          → "در حال آماده‌سازی…"
 *   - recording                                     → "● MM:SS"  (stop)
 *
 * The button is purely a control — the side notice that "this is local
 * only" lives near the toolbar in the meeting room layout.
 */
export function RecordingButton({ recorder, hideOnMobile = false }: Props) {
  const { status, elapsedSeconds, start, stop, statusLabel } = recorder;
  const isRecording = status === 'recording';
  const isBusy = status === 'preparing' || status === 'stopping';
  const isUnsupported = status === 'unsupported';

  const onClick = () => {
    if (isBusy) return;
    if (isRecording) void stop();
    else void start();
  };

  const label = isRecording
    ? `${formatElapsed(elapsedSeconds)} · ${t.recording.btn.stop}`
    : isBusy
      ? t.recording.btn.preparing
      : t.recording.btn.start;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isBusy || isUnsupported}
      aria-label={statusLabel}
      title={isUnsupported ? t.recording.unsupported : statusLabel}
      aria-pressed={isRecording}
      className={[
        'inline-flex h-10 items-center gap-1.5 rounded-full px-2.5 text-sm transition-colors sm:h-11 sm:px-3',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
        'disabled:cursor-not-allowed disabled:opacity-60',
        isRecording
          ? 'bg-rose-500/20 text-rose-100 ring-1 ring-inset ring-rose-400/40 hover:bg-rose-500/30'
          : 'bg-white/10 text-white hover:bg-white/20',
        hideOnMobile ? 'hidden md:inline-flex' : 'inline-flex',
      ].join(' ')}
    >
      {isRecording ? (
        <>
          <Circle className="h-3 w-3 animate-pulse fill-rose-300 text-rose-300" />
          <span className="tabular-nums">{formatElapsed(elapsedSeconds)}</span>
        </>
      ) : isBusy ? (
        <Disc3 className="h-4 w-4 animate-spin" />
      ) : (
        <Square className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">{label.replace(/^[\d:]+ · /, '')}</span>
    </button>
  );
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
