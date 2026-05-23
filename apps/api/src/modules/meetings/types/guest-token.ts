/**
 * JWT payload set as the meetino_guest HttpOnly cookie after guest-join.
 * Scoped to ONE meeting via `room` so it can't be replayed at another slug.
 */
export interface GuestTokenPayload {
  type: 'guest';
  sub: string;       // meeting_participant id
  room: string;      // meeting slug
  name: string;      // display name snapshot (for fast reads without DB)
  iat?: number;
  exp?: number;
}
