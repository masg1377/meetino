'use client';

interface Props {
  /** Current real publication state for THIS user (driven by LiveKit). */
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenShareEnabled: boolean;
  /** Disable everything while the LiveKit room isn't fully connected. */
  disabled?: boolean;
  onToggleMic: () => void | Promise<void>;
  onToggleCamera: () => void | Promise<void>;
  onToggleScreenShare: () => void | Promise<void>;
  /** Optional leave-media button (closes LiveKit but keeps user in the room). */
  onLeaveMedia?: () => void;
}

/**
 * Bottom-of-stage controls.
 *
 * Phase 6: the toggles now drive real LiveKit publications (mic / camera
 * / screen share). The on/off state shown here reflects what's actually
 * being published, NOT the Phase 4 advisory flag (that's mirrored upstream
 * by the room page when LiveKit notifies us of a change).
 */
export function MediaControls({
  micEnabled,
  cameraEnabled,
  screenShareEnabled,
  disabled,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onLeaveMedia,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <ToggleButton
        label={micEnabled ? 'بستن میکروفون' : 'باز کردن میکروفون'}
        on={micEnabled}
        disabled={disabled}
        onClick={() => void onToggleMic()}
        icon={micEnabled ? <MicOn /> : <MicOff />}
      />
      <ToggleButton
        label={cameraEnabled ? 'بستن دوربین' : 'باز کردن دوربین'}
        on={cameraEnabled}
        disabled={disabled}
        onClick={() => void onToggleCamera()}
        icon={cameraEnabled ? <CamOn /> : <CamOff />}
      />
      <ToggleButton
        label={screenShareEnabled ? 'پایان اشتراک صفحه' : 'اشتراک‌گذاری صفحه'}
        on={screenShareEnabled}
        disabled={disabled}
        onClick={() => void onToggleScreenShare()}
        icon={screenShareEnabled ? <ScreenOn /> : <ScreenOff />}
      />
      {onLeaveMedia && (
        <button
          type="button"
          onClick={onLeaveMedia}
          aria-label="قطع تصویر و صدا"
          title="قطع تصویر و صدا"
          className={[
            'inline-flex h-12 w-12 items-center justify-center rounded-full transition-colors',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500',
            'bg-rose-600 text-white hover:bg-rose-700',
          ].join(' ')}
        >
          <HangupIcon />
        </button>
      )}
    </div>
  );
}

function ToggleButton({
  label,
  on,
  disabled,
  onClick,
  icon,
}: {
  label: string;
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={[
        'inline-flex h-12 w-12 items-center justify-center rounded-full transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        on
          ? 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:outline-slate-400',
      ].join(' ')}
    >
      {icon}
    </button>
  );
}

// Inline icons — slightly larger than the list chips for the main controls.
function MicOn() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
    </svg>
  );
}
function MicOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M3 3l18 18M9 9v2a3 3 0 0 0 5.12 2.12M15 9V6a3 3 0 0 0-5.66-1.43" />
      <path d="M5 11a7 7 0 0 0 11.07 5.74M19 11a7 7 0 0 1-.21 1.74M12 18v3M9 21h6" />
    </svg>
  );
}
function CamOn() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="3" y="7" width="13" height="10" rx="2" />
      <path d="M16 11l5-3v8l-5-3" />
    </svg>
  );
}
function CamOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M3 3l18 18" />
      <path d="M16 11l5-3v8l-5-3" />
      <path d="M3 7v10a2 2 0 0 0 2 2h9" />
    </svg>
  );
}
function ScreenOn() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}
function ScreenOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
function HangupIcon() {
  // Standard "phone-down" glyph.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M21.39 13.45 17 12c-.62-.22-1.32-.05-1.79.4l-2.06 2.05A14.7 14.7 0 0 1 7.55 9.85l2.06-2.06c.45-.46.62-1.16.4-1.79L8.55 1.6A1.49 1.49 0 0 0 6.86.66L2.5 1.55A1.5 1.5 0 0 0 1.32 3.16C2.42 13.32 10.68 21.58 20.84 22.68a1.5 1.5 0 0 0 1.61-1.17l.89-4.37a1.49 1.49 0 0 0-.95-1.69Z" transform="rotate(135 12 12)" />
    </svg>
  );
}
