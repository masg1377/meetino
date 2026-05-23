'use client';
import { useBootstrapSession } from '@/hooks/useAuth';

/**
 * Meeting-shell layout. Phase 7.5: this layout now renders ONLY a session
 * bootstrap wrapper — no chrome. The pre-join page mounts its own AppHeader
 * (light theme), and the room page renders full-viewport dark. Keeping the
 * shell minimal lets each page own its visual treatment.
 */
export default function MeetingShellLayout({ children }: { children: React.ReactNode }) {
  // Restore registered-user session from the refresh cookie if present.
  // No-op for guests — the meeting routes don't gate on auth.
  useBootstrapSession();
  return <>{children}</>;
}
