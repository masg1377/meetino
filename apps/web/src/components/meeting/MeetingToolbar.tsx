'use client';
import {
  FileText,
  Mic,
  MicOff,
  MessageSquare,
  MonitorUp,
  MonitorOff,
  PencilRuler,
  PhoneOff,
  Users,
  Video,
  VideoOff,
} from 'lucide-react';
import { t } from '@/lib/i18n';
import { MediaControlButton } from './MediaControlButton';

interface MeetingToolbarProps {
  /** Center cluster — live media state. */
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenShareEnabled: boolean;
  disabled?: boolean;
  onToggleMic: () => void | Promise<void>;
  onToggleCamera: () => void | Promise<void>;
  onToggleScreenShare: () => void | Promise<void>;
  onLeave: () => void;

  /** Right cluster — UI panel toggles. */
  participantCount: number;
  unreadChat?: number;
  participantsOpen: boolean;
  chatOpen: boolean;
  onToggleParticipants: () => void;
  onToggleChat: () => void;

  /** Left cluster — meeting info. */
  meetingTitle: string;
  meetingTimeLabel?: string;

  /**
   * Optional extra element rendered before the panel toggles.
   * Phase 7.6 uses this for the local-recording button.
   */
  extraRight?: React.ReactNode;

  // ── Phase 7.7 — collaboration toggles ───────────────────────────
  whiteboardOpen?: boolean;
  onToggleWhiteboard?: () => void;
  filesOpen?: boolean;
  onToggleFiles?: () => void;
  filesCount?: number;
  /**
   * Phase 7.7 — slot rendered immediately after the camera button.
   * The room page passes a `<CameraEffectsButton />` here so the popover
   * menu can be anchored to it without the toolbar owning the state.
   */
  cameraEffectsSlot?: React.ReactNode;
}

/**
 * Bottom toolbar for the meeting room. Renders as an in-flow flex row at
 * the bottom of the parent column (NOT `fixed`) — that way the stage above
 * is always sized to the remaining height and can't scroll under the bar.
 * Three clusters:
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ [meeting info]   [mic][cam][screen]   [hang up]   [chat][users] │
 *   └──────────────────────────────────────────────────────────────────┘
 */
export function MeetingToolbar({
  micEnabled,
  cameraEnabled,
  screenShareEnabled,
  disabled,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onLeave,
  participantCount,
  unreadChat,
  participantsOpen,
  chatOpen,
  onToggleParticipants,
  onToggleChat,
  meetingTitle,
  meetingTimeLabel,
  extraRight,
  whiteboardOpen = false,
  onToggleWhiteboard,
  filesOpen = false,
  onToggleFiles,
  filesCount,
  cameraEffectsSlot,
}: MeetingToolbarProps) {
  return (
    <div className="z-30 flex shrink-0 justify-center px-2 pb-3 sm:px-6 sm:pb-4">
      <div className="flex w-full max-w-5xl items-center justify-between gap-2 rounded-3xl border border-white/10 bg-slate-900/80 px-3 py-2.5 shadow-2xl backdrop-blur sm:gap-3 sm:px-4 sm:py-3">
        {/* Left — meeting info (desktop only; the header carries this on mobile) */}
        <div className="hidden min-w-0 items-center gap-3 lg:flex">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{meetingTitle}</p>
            {meetingTimeLabel && (
              <p className="text-[11px] text-white/60">{meetingTimeLabel}</p>
            )}
          </div>
        </div>

        {/* Center — media controls (always visible) */}
        <div className="flex items-center gap-2">
          <MediaControlButton
            active={micEnabled}
            iconOn={<Mic className="h-5 w-5" />}
            iconOff={<MicOff className="h-5 w-5" />}
            label={micEnabled ? 'بستن میکروفون' : 'باز کردن میکروفون'}
            disabled={disabled}
            onClick={() => void onToggleMic()}
          />
          <MediaControlButton
            active={cameraEnabled}
            iconOn={<Video className="h-5 w-5" />}
            iconOff={<VideoOff className="h-5 w-5" />}
            label={cameraEnabled ? 'بستن دوربین' : 'باز کردن دوربین'}
            disabled={disabled}
            onClick={() => void onToggleCamera()}
          />
          {cameraEffectsSlot}
          <MediaControlButton
            active={screenShareEnabled}
            iconOn={<MonitorOff className="h-5 w-5" />}
            iconOff={<MonitorUp className="h-5 w-5" />}
            label={screenShareEnabled ? 'پایان اشتراک صفحه' : 'اشتراک‌گذاری صفحه'}
            disabled={disabled}
            onClick={() => void onToggleScreenShare()}
          />

          <span className="mx-1 hidden h-8 w-px bg-white/15 sm:block" aria-hidden="true" />

          <MediaControlButton
            active={false}
            iconOn={<PhoneOff className="h-5 w-5" />}
            iconOff={<PhoneOff className="h-5 w-5" />}
            label="خروج از جلسه"
            destructive
            onClick={onLeave}
          />
        </div>

        {/* Right — panel toggles (visible on all sizes; condensed on mobile) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {extraRight}
          {onToggleWhiteboard && (
            <ToolbarPanelButton
              active={whiteboardOpen}
              label={t.toolbar.whiteboard}
              onClick={onToggleWhiteboard}
            >
              <PencilRuler className="h-5 w-5" />
            </ToolbarPanelButton>
          )}
          {onToggleFiles && (
            <ToolbarPanelButton
              active={filesOpen}
              label={t.toolbar.files}
              badge={filesCount && !filesOpen ? filesCount : undefined}
              onClick={onToggleFiles}
            >
              <FileText className="h-5 w-5" />
            </ToolbarPanelButton>
          )}
          <ToolbarPanelButton
            active={chatOpen}
            label="چت"
            badge={unreadChat && !chatOpen ? unreadChat : undefined}
            onClick={onToggleChat}
          >
            <MessageSquare className="h-5 w-5" />
          </ToolbarPanelButton>
          <ToolbarPanelButton
            active={participantsOpen}
            label={`شرکت‌کنندگان (${participantCount})`}
            onClick={onToggleParticipants}
          >
            <Users className="h-5 w-5" />
            <span className="hidden text-[11px] sm:inline">{participantCount}</span>
          </ToolbarPanelButton>
        </div>
      </div>
    </div>
  );
}

function ToolbarPanelButton({
  active,
  label,
  badge,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  badge?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={[
        'relative inline-flex h-10 items-center gap-1.5 rounded-full px-2.5 text-sm transition-colors sm:h-11 sm:px-3',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
        active
          ? 'bg-white text-slate-900 hover:bg-slate-100'
          : 'bg-white/10 text-white hover:bg-white/20',
      ].join(' ')}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 end-0 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-medium text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}
