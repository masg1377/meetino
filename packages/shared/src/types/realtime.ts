/**
 * Realtime contract shared by the NestJS gateway and the Next.js client.
 *
 * Phase 4 ONLY covers presence + UI state (mic / camera flags). No media
 * is exchanged yet — these flags are advisory and updated only by the owner.
 */
import type { ParticipantRole, ParticipantType } from '../enums';

// ── Connection status (frontend-only enum, kept here for type sharing) ──

export const ConnectionStatus = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
} as const;
export type ConnectionStatus =
  (typeof ConnectionStatus)[keyof typeof ConnectionStatus];

// ── Per-participant runtime state ────────────────────────────────────

/**
 * Live state of one participant in a meeting room. Kept intentionally small;
 * persistent identity (userId, role, type, displayName) is set on join and
 * never mutated by realtime events.
 */
export interface ParticipantState {
  participantId: string;
  displayName: string;
  role: ParticipantRole;
  type: ParticipantType;
  /** Present only for REGISTERED participants. */
  userId: string | null;
  /** True while at least one socket is open for this participant. */
  isOnline: boolean;
  /** Owner-controlled advisory flag — no media is actually captured yet. */
  micEnabled: boolean;
  /** Owner-controlled advisory flag — no media is actually captured yet. */
  cameraEnabled: boolean;
  /** ISO timestamp; updated when isOnline flips to false. */
  lastSeenAt: string | null;
  /** ISO timestamp of first connect in this room. */
  joinedAt: string;
}

// ── Event name constants (used by both sides for type-safety) ────────

export const MeetingClientEvent = {
  JOIN: 'meeting:join',
  LEAVE: 'meeting:leave',
  MIC_TOGGLE: 'participant:mic-toggle',
  CAMERA_TOGGLE: 'participant:camera-toggle',
  // Phase 7.7 — whiteboard
  WHITEBOARD_OP: 'whiteboard:op',
  WHITEBOARD_CLEAR: 'whiteboard:clear',
  WHITEBOARD_SNAPSHOT_REQUEST: 'whiteboard:snapshot-request',
} as const;
export type MeetingClientEvent =
  (typeof MeetingClientEvent)[keyof typeof MeetingClientEvent];

export const MeetingServerEvent = {
  PARTICIPANT_JOINED: 'meeting:participant-joined',
  PARTICIPANT_LEFT: 'meeting:participant-left',
  PARTICIPANTS_UPDATED: 'meeting:participants-updated',
  STATE_UPDATED: 'participant:state-updated',
  ERROR: 'meeting:error',
  // Phase 7 — security broadcasts.
  LOCKED: 'meeting:locked',
  UNLOCKED: 'meeting:unlocked',
  ENDED: 'meeting:ended',
  PARTICIPANT_KICKED: 'participant:kicked',
  // Phase 7.6 — rejoin approval workflow.
  REJOIN_REQUESTED: 'participant:rejoin-requested',
  REJOIN_APPROVED: 'participant:rejoin-approved',
  REJOIN_REJECTED: 'participant:rejoin-rejected',
  // Phase 7.7 — whiteboard + file sharing
  WHITEBOARD_OP: 'whiteboard:op',
  WHITEBOARD_CLEAR: 'whiteboard:clear',
  WHITEBOARD_SNAPSHOT: 'whiteboard:snapshot',
  FILE_SHARED: 'meeting:file-shared',
  FILE_DELETED: 'meeting:file-deleted',
} as const;
export type MeetingServerEvent =
  (typeof MeetingServerEvent)[keyof typeof MeetingServerEvent];

// ── Client → Server payloads ─────────────────────────────────────────

/** Empty by design — the slug + identity were already verified at connect. */
export interface MeetingJoinPayload {}

/** Empty by design. */
export interface MeetingLeavePayload {}

export interface MicTogglePayload {
  enabled: boolean;
}

export interface CameraTogglePayload {
  enabled: boolean;
}

// ── Server → Client payloads ─────────────────────────────────────────

export interface ParticipantJoinedPayload {
  participant: ParticipantState;
}

export interface ParticipantLeftPayload {
  participantId: string;
}

export interface ParticipantsUpdatedPayload {
  participants: ParticipantState[];
}

export interface ParticipantStateUpdatedPayload {
  participantId: string;
  /** Only the changed flags are sent. */
  patch: Partial<
    Pick<ParticipantState, 'micEnabled' | 'cameraEnabled' | 'isOnline' | 'lastSeenAt'>
  >;
}

/**
 * Error codes are stable strings the client can branch on. Human-readable
 * `message` is Persian-friendly when surfaced to UI.
 */
export const RealtimeErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  INTERNAL: 'INTERNAL',
} as const;
export type RealtimeErrorCode =
  (typeof RealtimeErrorCode)[keyof typeof RealtimeErrorCode];

export interface MeetingErrorPayload {
  code: RealtimeErrorCode;
  message: string;
}

// ── Phase 7 security broadcasts ──────────────────────────────────────

export interface MeetingLockedPayload {
  /** ISO timestamp when the lock was applied. */
  at: string;
}

export interface MeetingUnlockedPayload {
  at: string;
}

export interface MeetingEndedPayload {
  at: string;
  /** participantId of the host who ended it (null if ended by admin/system). */
  endedByParticipantId: string | null;
}

export interface ParticipantKickedPayload {
  participantId: string;
  /** Display name snapshot — convenient for toast messages. */
  displayName: string;
  /** participantId of the actor; null if performed by system / admin. */
  kickedByParticipantId: string | null;
  at: string;
}

// ── Phase 7.6 rejoin workflow ────────────────────────────────────────

/** Host receives this when a kicked participant asks to rejoin. */
export interface ParticipantRejoinRequestedPayload {
  requestId: string;
  participantId: string;
  displayName: string;
  participantType: 'REGISTERED' | 'GUEST';
  message: string | null;
  at: string;
}

/** Both the host's clients and the kicked participant receive this. */
export interface ParticipantRejoinApprovedPayload {
  requestId: string;
  participantId: string;
  displayName: string;
  approvedByParticipantId: string | null;
  at: string;
}

export interface ParticipantRejoinRejectedPayload {
  requestId: string;
  participantId: string;
  displayName: string;
  rejectedByParticipantId: string | null;
  at: string;
}
