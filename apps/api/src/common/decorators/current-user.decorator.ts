import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { PlatformRole } from '@meetino/shared';

/**
 * The authenticated principal that JwtStrategy.validate() returns.
 * Available on req.user after JwtAuthGuard runs.
 */
export interface AuthUser {
  id: string;
  email: string;
  role: PlatformRole;
}

/**
 * Usage:
 *   @Get('me')
 *   me(@CurrentUser() user: AuthUser) { ... }
 *
 *   @Get('something')
 *   something(@CurrentUser('id') userId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | unknown => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
