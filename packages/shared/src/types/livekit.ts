/**
 * Phase 6 — LiveKit integration types shared by backend + frontend.
 *
 * The backend NEVER sends the API secret. Only a short-lived JWT signed
 * with the secret is returned, scoped to a single LiveKit room.
 */
import type { ParticipantRole, ParticipantType } from '../enums';

/** Response of POST /api/meetings/:slug/livekit-token. */
export interface LivekitTokenResponse {
  /** Signed JWT to hand to `room.connect(url, token)` on the client. */
  token: string;
  /** WebSocket URL the client should connect to. */
  url: string;
  /** LiveKit room name (same as the meeting slug for Phase 6). */
  room: string;
  /** Echo of the token's `identity` field — for client sanity-checks. */
  identity: string;
}

/**
 * Decoded shape of the JSON we pack into LiveKit's `metadata` field.
 * LiveKit makes this string available on every participant, so other
 * clients can read display name / role / type without an extra round-trip.
 */
export interface LivekitParticipantMetadata {
  participantId: string;
  displayName: string;
  role: ParticipantRole;
  type: ParticipantType;
  /** Null for guests. */
  userId: string | null;
}
