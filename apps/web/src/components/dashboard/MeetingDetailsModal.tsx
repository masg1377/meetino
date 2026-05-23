'use client';
import { useEffect, useState } from 'react';
import {
  CalendarClock,
  Clock,
  Hash,
  MessagesSquare,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import type {
  AttendanceRecord,
  MeetingDetailsDto,
  MeetingStatus,
} from '@meetino/shared';
import { apiClient, ApiError } from '@/lib/api-client';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { t } from '@/lib/i18n';
import {
  formatDateTimeFa,
  formatDurationCompactFa,
  formatDurationFa,
  toFa,
} from '@/lib/format';

/**
 * Phase 7.6 — meeting-details modal opened from HistoryList.
 *
 * Pulls /meetings/:slug/details. The backend returns either a full
 * host-view (every participant) or a redacted view (only the caller's
 * own row), and tags which one via `isHostView`. The UI mirrors that:
 * the redacted view shows a notice instead of pretending to be complete.
 */
export function MeetingDetailsModal({
  slug,
  onClose,
}: {
  slug: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<MeetingDetailsDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = slug !== null;

  // Reset state every time the modal opens for a different slug.
  useEffect(() => {
    if (!open) {
      setData(null);
      setError(null);
      return;
    }
    let alive = true;
    setError(null);
    setData(null);
    apiClient
      .get<MeetingDetailsDto>(`/meetings/${slug}/details`)
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof ApiError ? err.message : 'بارگذاری ناموفق بود.');
      });
    return () => {
      alive = false;
    };
  }, [open, slug]);

  // Esc close + body scroll lock.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm md:items-center md:p-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl md:rounded-2xl dark:bg-slate-900">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t.details.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="بستن"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grow overflow-y-auto px-6 py-5">
          {error && <Alert variant="error">{error}</Alert>}

          {!data && !error && (
            <div className="space-y-3">
              <div className="h-6 w-2/3 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              <div className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            </div>
          )}

          {data && (
            <div className="space-y-6">
              <MetaSection data={data} />
              {!data.isHostView && (
                <Alert variant="info">{t.details.redacted}</Alert>
              )}
              <AttendanceTable rows={data.attendance} />
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/60">
          <Button variant="secondary" onClick={onClose}>
            {t.common.close}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MetaSection({ data }: { data: MeetingDetailsDto }) {
  const m = data.meeting;
  return (
    <section>
      <header className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-brand-600" />
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          {t.details.sectionMeta}
        </h3>
      </header>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetaRow icon={<Hash className="h-3.5 w-3.5" />} label={t.details.fields.slug}>
          <span dir="ltr" className="font-mono text-xs">
            {m.slug}
          </span>
        </MetaRow>
        <MetaRow icon={<ShieldCheck className="h-3.5 w-3.5" />} label={t.details.fields.status}>
          <span>{t.history.statuses[m.status as MeetingStatus]}</span>
        </MetaRow>
        <MetaRow icon={<UserRound className="h-3.5 w-3.5" />} label={t.details.fields.host}>
          {m.hostDisplayName}
        </MetaRow>
        <MetaRow
          icon={<CalendarClock className="h-3.5 w-3.5" />}
          label={t.details.fields.createdAt}
        >
          {formatDateTimeFa(m.createdAt)}
        </MetaRow>
        <MetaRow icon={<Clock className="h-3.5 w-3.5" />} label={t.details.fields.startedAt}>
          {formatDateTimeFa(m.startedAt)}
        </MetaRow>
        <MetaRow icon={<Clock className="h-3.5 w-3.5" />} label={t.details.fields.endedAt}>
          {formatDateTimeFa(m.endedAt)}
        </MetaRow>
        <MetaRow icon={<Clock className="h-3.5 w-3.5" />} label={t.details.fields.duration}>
          {formatDurationFa(m.durationSeconds)}
        </MetaRow>
        <MetaRow
          icon={<MessagesSquare className="h-3.5 w-3.5" />}
          label={t.details.fields.chatCount}
        >
          {toFa(data.chatMessageCount)}
        </MetaRow>
      </dl>
    </section>
  );
}

function MetaRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
      <dt className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
        {children}
      </dd>
    </div>
  );
}

function AttendanceTable({ rows }: { rows: AttendanceRecord[] }) {
  return (
    <section>
      <header className="mb-3 flex items-center gap-2">
        <UserRound className="h-4 w-4 text-brand-600" />
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          {t.details.sectionAttendance}
        </h3>
        <span className="ms-2 text-xs text-slate-500 dark:text-slate-400">
          ({toFa(rows.length)})
        </span>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {t.details.attendance.empty}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="min-w-full text-right text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <Th>{t.details.attendance.colName}</Th>
                <Th>{t.details.attendance.colKind}</Th>
                <Th>{t.details.attendance.colRole}</Th>
                <Th>{t.details.attendance.colJoinedAt}</Th>
                <Th>{t.details.attendance.colLeftAt}</Th>
                <Th>{t.details.attendance.colDuration}</Th>
                <Th>{t.details.attendance.colStatus}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => (
                <tr key={r.participantId} className="bg-white dark:bg-slate-900">
                  <Td className="font-medium text-slate-900 dark:text-white">
                    {r.displayName}
                  </Td>
                  <Td>
                    {r.type === 'REGISTERED'
                      ? t.details.attendance.kindRegistered
                      : t.details.attendance.kindGuest}
                  </Td>
                  <Td>
                    {r.role === 'HOST'
                      ? t.details.attendance.roleHost
                      : r.role === 'STUDENT'
                        ? t.details.attendance.roleStudent
                        : t.details.attendance.roleGuest}
                  </Td>
                  <Td>{formatDateTimeFa(r.joinedAt)}</Td>
                  <Td>{formatDateTimeFa(r.leftAt)}</Td>
                  <Td className="tabular-nums">
                    {formatDurationCompactFa(r.totalDurationSeconds)}
                  </Td>
                  <Td>
                    <StatusPill status={r.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: AttendanceRecord['status'] }) {
  const map: Record<AttendanceRecord['status'], { cls: string; label: string }> = {
    active: {
      cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-900/60',
      label: t.details.attendance.statusActive,
    },
    left: {
      cls: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
      label: t.details.attendance.statusLeft,
    },
    kicked: {
      cls: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:ring-rose-900/60',
      label: t.details.attendance.statusKicked,
    },
  };
  const { cls, label } = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${cls}`}
    >
      {label}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-medium">{children}</th>;
}

function Td({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-3 py-2 align-middle text-slate-700 dark:text-slate-200 ${className}`}>
      {children}
    </td>
  );
}
