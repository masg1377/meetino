import type { ParticipantRole, ParticipantType } from '../enums';

/**
 * Slim participant identity returned to clients. Used in join responses,
 * room data, and (later) participant lists.
 */
export interface ParticipantInfo {
  id: string;
  displayName: string;
  role: ParticipantRole;
  type: ParticipantType;
  /** Present only for REGISTERED participants — useful for routing/profile links later. */
  userId: string | null;
}

/**
 * Response shape for both POST /meetings/:slug/join and
 * POST /meetings/:slug/guest-join. The guest variant additionally sets an
 * HttpOnly cookie server-side; clients don't see the token directly.
 */
export interface JoinMeetingResponse {
  participant: ParticipantInfo;
  meeting: { id: string; slug: string; title: string };
}
