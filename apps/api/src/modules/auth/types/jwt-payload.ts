import type { PlatformRole } from '@meetino/shared';

/**
 * Shape of the access-token JWT payload. Keep tiny — clients should fetch
 * the rest of the user via /api/auth/me.
 */
export interface JwtPayload {
  sub: string;        // user id
  email: string;
  role: PlatformRole;
  type: 'access';
  iat?: number;
  exp?: number;
}
