import type { PlatformRole } from '../enums';

/**
 * Public user shape returned by the API. Never includes password_hash or
 * any sensitive internal fields.
 */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: PlatformRole;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string; // ISO timestamp
}
