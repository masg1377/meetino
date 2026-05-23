import type { MeetingStatus } from '../enums';
import type { ParticipantInfo } from './participant';

/**
 * Full meeting shape returned to the host / admin.
 * Excludes nothing sensitive — there is nothing sensitive on the row itself
 * besides settings, which we currently keep empty.
 */
export interface MeetingDto {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  hostId: string;
  hostDisplayName: string;
  status: MeetingStatus;
  scheduledFor: string | null;
  startedAt: string | null;
  endedAt: string | null;
  /** Phase 7 — set when the meeting was ended by a host. */
  endedById: string | null;
  /** Phase 7 — when true, only host/admin (or already-joined) can enter. */
  isLocked: boolean;
  /** Phase 7 — true if a password is set. Hash is never returned. */
  hasPassword: boolean;
  /**
   * Phase 7.6 — duration in seconds.
   * - For ENDED meetings: persisted endedAt - startedAt.
   * - For LIVE meetings: computed live as (now - startedAt) by the API at
   *   serialization time, so the client doesn't have to compute clock skew.
   * - For SCHEDULED meetings: null.
   */
  durationSeconds: number | null;
  /**
   * Phase 7.6 — set when the meeting was ended by the auto-end Cron job
   * (empty for > 60 minutes). Used by the client to swap in the
   * "auto-ended" Persian banner instead of the generic ended screen.
   */
  autoEndedReason: 'EMPTY_TIMEOUT' | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The minimum-disclosure shape returned by the PUBLIC lookup endpoint.
 * Used by the pre-join page. NEVER includes IDs, settings, or anything that
 * could leak about the host beyond their display name.
 *
 * Phase 7 adds two booleans so the pre-join page can render the right state
 * (locked / password required) without an extra round-trip.
 */
export interface PublicMeetingDto {
  slug: string;
  title: string;
  status: MeetingStatus;
  hostDisplayName: string;
  scheduledFor: string | null;
  isLocked: boolean;
  hasPassword: boolean;
}

/**
 * Returned by /room — includes the meeting + the caller's participant identity.
 *
 * Phase 7.6 adds two flags so the client can render the "you were kicked"
 * screen and the host-side approval prompts without an extra round-trip.
 */
export interface MeetingRoomDto {
  meeting: MeetingDto;
  participant: ParticipantInfo;
  isHost: boolean;
  /** True if the caller is currently flagged kicked. */
  wasKicked: boolean;
  /**
   * If the kicked caller has a pending rejoin-request, its id. The UI uses
   * this to disable the "request rejoin" button after a submission.
   */
  pendingRejoinRequestId: string | null;
}

// ── Requests ────────────────────────────────────────────────────────

export interface CreateMeetingRequest {
  title: string;
  description?: string;
  scheduledFor?: string; // ISO timestamp; if absent, status starts as LIVE
}

export interface GuestJoinRequest {
  displayName: string;
  /** Optional — required when PublicMeetingDto.hasPassword is true. */
  password?: string;
}

/** Optional password for registered-user join when hasPassword is true. */
export interface RegisteredJoinRequest {
  password?: string;
}

// ── Phase 7 host-control requests ────────────────────────────────────

export interface SetMeetingPasswordRequest {
  password: string;
}

// ── Phase 7.6 — history, details, stats, rejoin ─────────────────────

/** One attendance row in MeetingDetails. */
export type AttendanceStatus = 'active' | 'left' | 'kicked';

export interface AttendanceRecord {
  participantId: string;
  displayName: string;
  /** REGISTERED users have an associated userId; GUESTs don't. */
  type: 'REGISTERED' | 'GUEST';
  role: 'HOST' | 'STUDENT' | 'GUEST';
  joinedAt: string | null;
  leftAt: string | null;
  totalDurationSeconds: number;
  status: AttendanceStatus;
  /** Best-effort: true if currently online in the room (live meetings only). */
  isOnline: boolean;
}

/** GET /api/meetings/:slug/details */
export interface MeetingDetailsDto {
  meeting: MeetingDto;
  attendance: AttendanceRecord[];
  chatMessageCount: number;
  /**
   * True only when the caller is the host or a platform ADMIN. Drives what
   * the UI shows: full attendance for the host, summary view for everyone else.
   */
  isHostView: boolean;
}

/** GET /api/meetings/history */
export interface MeetingHistoryItem {
  id: string;
  slug: string;
  title: string;
  status: MeetingStatus;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  participantCount: number;
  guestCount: number;
  createdAt: string;
}

/** GET /api/meetings/stats/me */
export interface MeetingStatsDto {
  totalMeetings: number;
  endedMeetings: number;
  activeMeetings: number;
  totalDurationSeconds: number;
  averageDurationSeconds: number;
  totalParticipants: number;
  totalGuests: number;
  recentMeetings: MeetingHistoryItem[];
}

/** POST /api/meetings/:slug/rejoin-request */
export interface CreateRejoinRequestBody {
  /** Optional Persian/free-text message to the host. */
  message?: string;
}

export interface RejoinRequestDto {
  id: string;
  meetingId: string;
  meetingSlug: string;
  participantId: string;
  displayName: string;
  participantType: 'REGISTERED' | 'GUEST';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  message: string | null;
  createdAt: string;
  resolvedAt: string | null;
}
