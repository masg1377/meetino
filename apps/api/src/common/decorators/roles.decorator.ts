import { SetMetadata } from '@nestjs/common';
import type { PlatformRole } from '@meetino/shared';

/**
 * Mark a route as requiring one or more platform roles.
 *   @Roles('ADMIN')
 *   @Roles('ADMIN', 'HOST')
 *
 * Enforced by RolesGuard (which must run AFTER JwtAuthGuard).
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: PlatformRole[]) => SetMetadata(ROLES_KEY, roles);
