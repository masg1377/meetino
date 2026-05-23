'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type {
  AuthResponse,
  LoginRequest,
  MeResponse,
  RegisterRequest,
} from '@meetino/shared';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Top-level auth hook. Use anywhere — register/login pages, dashboard, etc.
 *
 * - bootstrapSession() restores the session from the refresh cookie on app start.
 * - register/login/logout perform the relevant API calls and update the store.
 */
export function useAuth() {
  const { user, accessToken, isHydrated, setSession, clear } = useAuthStore();
  const router = useRouter();

  const register = async (input: RegisterRequest) => {
    const data = await apiClient.post<AuthResponse>('/auth/register', input, { skipAuth: true });
    setSession(data);
    return data;
  };

  const login = async (input: LoginRequest) => {
    const data = await apiClient.post<AuthResponse>('/auth/login', input, { skipAuth: true });
    setSession(data);
    return data;
  };

  const logout = async () => {
    try {
      await apiClient.post<void>('/auth/logout', undefined, { skipAuth: true });
    } finally {
      clear();
      router.push('/login');
    }
  };

  const refreshMe = async (): Promise<MeResponse | null> => {
    try {
      const me = await apiClient.get<MeResponse>('/auth/me');
      useAuthStore.getState().setUser(me);
      return me;
    } catch {
      return null;
    }
  };

  return {
    user,
    accessToken,
    isHydrated,
    isAuthenticated: !!user && !!accessToken,
    register,
    login,
    logout,
    refreshMe,
  };
}

/**
 * Bootstraps the session from the refresh cookie. Call this once at app start
 * (e.g., in the dashboard layout or a top-level provider).
 */
export function useBootstrapSession() {
  const { setSession, setHydrated, clear, isHydrated } = useAuthStore();

  useEffect(() => {
    if (isHydrated) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.post<AuthResponse>('/auth/refresh', undefined, {
          skipAuth: true,
          skipAuthRefresh: true,
        });
        if (!cancelled) setSession(data);
      } catch {
        if (!cancelled) clear();
      } finally {
        if (!cancelled) setHydrated();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isHydrated, setSession, clear, setHydrated]);
}
