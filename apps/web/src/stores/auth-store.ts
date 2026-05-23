/**
 * Zustand store for client-side auth state.
 *
 * - Access token kept IN MEMORY only. Never localStorage (XSS-safe).
 * - On hard reload, the API client calls /auth/refresh which reads the
 *   HttpOnly cookie and restores the session.
 */
import { create } from 'zustand';
import type { AuthResponse, PublicUser } from '@meetino/shared';

interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;
  /** True until we've checked for an existing session at app start. */
  isHydrated: boolean;

  setSession: (resp: AuthResponse) => void;
  setUser: (user: PublicUser | null) => void;
  setHydrated: () => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isHydrated: false,

  setSession: (resp) =>
    set({
      user: resp.user,
      accessToken: resp.accessToken,
      isHydrated: true,
    }),

  setUser: (user) => set({ user }),

  setHydrated: () => set({ isHydrated: true }),

  clear: () =>
    set({
      user: null,
      accessToken: null,
      isHydrated: true,
    }),
}));
