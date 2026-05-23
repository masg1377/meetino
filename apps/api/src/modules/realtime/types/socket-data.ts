import type { ParticipantRole, ParticipantType } from '@meetino/shared';

/**
 * What we attach to `socket.data` after the connection handshake passes auth.
 * Once set, the gateway never re-reads tokens from the socket — it trusts
 * this snapshot. The participant row itself is the source of truth for role.
 */
export interface AuthedSocketData {
  participantId: string;
  meetingId: string;
  slug: string;
  displayName: string;
  role: ParticipantRole;
  type: ParticipantType;
  /** Present only for REGISTERED participants. */
  userId: string | null;
  /** True once the client has emitted meeting:join. */
  inRoom: boolean;
}
