'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  /** The raw user preference (may be 'system'). */
  preference: ThemePreference;
  /** The actually applied theme — 'system' is resolved to light or dark. */
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
  /** Convenience: cycles light → dark → system → light … */
  toggle: () => void;
}

const STORAGE_KEY = 'meetino:theme';
const ORDER: readonly ThemePreference[] = ['light', 'dark', 'system'];

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // ignore
  }
  return 'system';
}

function applyClass(theme: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  // Tells the UA to use dark form controls / scrollbars when applicable.
  root.style.colorScheme = theme;
  // Mirror as a data-attribute too — handy for CSS selectors that don't
  // care about Tailwind's `dark:` variant.
  root.dataset.theme = theme;
}

/**
 * Top-level theme provider. Mounts once at the app root and keeps the
 * <html> class + data-theme attr in sync with the user's stored
 * preference (or the system preference when "system" is selected).
 *
 * Robustness notes:
 *   - `prefRef` always mirrors the latest preference so the `toggle`
 *     callback never sees stale state, even if a consumer holds the
 *     same `toggle` reference across renders.
 *   - The initial useState is 'system'; the very first effect immediately
 *     overrides it with the real value from localStorage. The
 *     <html suppressHydrationWarning> in layout.tsx silences the resulting
 *     class diff during hydration.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [resolved, setResolved] = useState<ResolvedTheme>('light');
  const prefRef = useRef<ThemePreference>('system');
  prefRef.current = preference;

  // Hydration — read storage + system pref on mount, apply class.
  useEffect(() => {
    const pref = readPreference();
    const sys = readSystemTheme();
    const next: ResolvedTheme = pref === 'system' ? sys : pref;
    setPreferenceState(pref);
    setResolved(next);
    applyClass(next);
  }, []);

  // Watch system preference while the user has 'system' selected.
  useEffect(() => {
    if (typeof window === 'undefined' || preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const next: ResolvedTheme = mq.matches ? 'dark' : 'light';
      setResolved(next);
      applyClass(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore (private mode etc.)
    }
    const sys = readSystemTheme();
    const resolvedNext: ResolvedTheme = next === 'system' ? sys : next;
    setPreferenceState(next);
    setResolved(resolvedNext);
    applyClass(resolvedNext);
  }, []);

  // Stable across renders — reads the latest preference from the ref so
  // it can never see a stale closure value.
  const toggle = useCallback(() => {
    const current = prefRef.current;
    const idx = ORDER.indexOf(current);
    const next = ORDER[(idx + 1) % ORDER.length];
    setPreference(next);
  }, [setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference, toggle }),
    [preference, resolved, setPreference, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Loud noise during dev if a component is rendered outside the provider —
    // production gets a quiet fallback so we never crash a render.
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[meetino] useTheme() called outside <ThemeProvider>');
    }
    return {
      preference: 'system',
      resolved: 'light',
      setPreference: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}

/**
 * Inline script that runs BEFORE React hydrates, reading the saved theme
 * (or system preference) and applying the `dark` class to <html> so the
 * very first paint matches the user's selection — no light/dark flash.
 *
 * Render this inside <head> in the root layout.
 */
export const THEME_BOOTSTRAP_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    var sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = stored === 'dark' || (stored !== 'light' && sysDark);
    var root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
      root.dataset.theme = 'dark';
    } else {
      root.style.colorScheme = 'light';
      root.dataset.theme = 'light';
    }
  } catch (e) {}
})();
`.trim();
