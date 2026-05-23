/**
 * Thin typed fetch wrapper for the Meetino API.
 *
 * - Sends credentials (cookies) on every request so the refresh cookie is included.
 * - Attaches the access token from the auth store as a Bearer header.
 * - On 401, transparently tries to refresh the access token once, then retries.
 * - Throws ApiError with status + message for consumers to handle.
 */
import type { AuthResponse } from '@meetino/shared';
import { useAuthStore } from '@/stores/auth-store';
import { translateServerError } from '@/lib/i18n';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip the automatic refresh-on-401 retry. Used internally by refresh(). */
  skipAuthRefresh?: boolean;
  /** Skip attaching the bearer token (for /auth/login, /auth/register, /auth/refresh). */
  skipAuth?: boolean;
}

async function rawRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, skipAuthRefresh, headers, ...rest } = opts;
  const url = `${API_URL}${path}`;

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((headers as Record<string, string>) ?? {}),
  };

  if (!skipAuth) {
    const token = useAuthStore.getState().accessToken;
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...rest,
    credentials: 'include',
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 401 + we have a refresh cookie? Try refresh once, then retry.
  if (response.status === 401 && !skipAuthRefresh && !skipAuth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return rawRequest<T>(path, { ...opts, skipAuthRefresh: true });
    }
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = undefined;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const rawMessage =
      (typeof payload === 'object' && payload && 'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : undefined) ??
      (Array.isArray((payload as { message?: unknown })?.message)
        ? ((payload as { message: string[] }).message[0] ?? 'Request failed')
        : 'Request failed');
    const code =
      typeof payload === 'object' && payload && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `HTTP_${response.status}`;
    // Phase 7.5 — every API error gets normalized to Persian here so we
    // don't have to translate at each call site. Unknown patterns fall
    // back to the original (English) text.
    const message = translateServerError(String(rawMessage));
    throw new ApiError(response.status, code, message, payload);
  }

  return payload as T;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const data = await rawRequest<AuthResponse>('/auth/refresh', {
      method: 'POST',
      skipAuth: true,
      skipAuthRefresh: true,
    });
    useAuthStore.getState().setSession(data);
    return true;
  } catch {
    useAuthStore.getState().clear();
    return false;
  }
}

export const apiClient = {
  get: <T>(path: string, opts?: RequestOptions) => rawRequest<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    rawRequest<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    rawRequest<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, opts?: RequestOptions) => rawRequest<T>(path, { ...opts, method: 'DELETE' }),
};
