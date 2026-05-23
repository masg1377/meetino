/**
 * Build the Socket.IO origin for the realtime gateway.
 *
 * Strategy:
 *   1. If NEXT_PUBLIC_WS_URL is set, trust it as-is (must point at the
 *      same origin as the API — Socket.IO appends the /realtime namespace).
 *   2. Otherwise derive from NEXT_PUBLIC_API_URL by stripping any trailing
 *      `/api` segment so we land on the bare origin.
 *   3. Fall back to localhost:4000 for dev.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const WS_OVERRIDE = process.env.NEXT_PUBLIC_WS_URL;

export function getSocketUrl(): string {
  if (WS_OVERRIDE && WS_OVERRIDE.length > 0) return WS_OVERRIDE;
  // Strip a trailing /api (no trailing slash) — turn http://host:4000/api → http://host:4000
  return API_URL.replace(/\/api\/?$/, '');
}

export const SOCKET_NAMESPACE = '/realtime';
