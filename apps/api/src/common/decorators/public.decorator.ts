import { SetMetadata } from '@nestjs/common';

/**
 * Marker that opts a route OUT of the global JwtAuthGuard.
 * Apply to routes that should be reachable without authentication
 * (e.g., POST /auth/login, GET /health/live).
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
