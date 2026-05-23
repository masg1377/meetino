/**
 * Platform-level roles stored on `users.role`.
 * Every registrant gets STUDENT.
 */
export const PlatformRole = {
  ADMIN: 'ADMIN',
  HOST: 'HOST',
  STUDENT: 'STUDENT',
} as const;
export type PlatformRole = (typeof PlatformRole)[keyof typeof PlatformRole];

/**
 * Meeting lifecycle status.
 */
export const MeetingStatus = {
  SCHEDULED: 'SCHEDULED',
  LIVE: 'LIVE',
  ENDED: 'ENDED',
  CANCELLED: 'CANCELLED',
} as const;
export type MeetingStatus = (typeof MeetingStatus)[keyof typeof MeetingStatus];

/**
 * Per-meeting role on `meeting_participants.role`.
 * A user can be HOST in one meeting and STUDENT in another.
 * GUEST is reserved for link-joiners with no account.
 */
export const ParticipantRole = {
  HOST: 'HOST',
  STUDENT: 'STUDENT',
  GUEST: 'GUEST',
} as const;
export type ParticipantRole = (typeof ParticipantRole)[keyof typeof ParticipantRole];

/**
 * Discriminates a participant by their identity source.
 * REGISTERED participants have `userId`; GUEST participants have `guestName`.
 */
export const ParticipantType = {
  REGISTERED: 'REGISTERED',
  GUEST: 'GUEST',
} as const;
export type ParticipantType = (typeof ParticipantType)[keyof typeof ParticipantType];
