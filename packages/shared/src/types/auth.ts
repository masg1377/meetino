import type { PublicUser } from './user';

/**
 * POST /api/auth/register
 */
export interface RegisterRequest {
  email: string;
  displayName: string;
  password: string;
}

/**
 * POST /api/auth/login
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Response shape for register, login, and refresh.
 * The refresh token itself travels only in an HttpOnly cookie — never in the body.
 */
export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  accessTokenExpiresIn: number; // seconds
}

/**
 * GET /api/auth/me — returns the currently authenticated user
 */
export type MeResponse = PublicUser;
