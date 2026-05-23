'use client';
import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, History as HistoryIcon, Users } from 'lucide-react';
import type { MeetingHistoryItem, MeetingStatus } from '@meetino/shared';
import { apiClient, ApiError } from '@/lib/api-client';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { t } from '@/lib/i18n';
import { formatDateTimeFa, formatDurationFa, toFa } from '@/lib/format';
import { MeetingDetailsModal } from './MeetingDetailsModal';

/**
 * Phase 7.6 — the dashboard's "آخرین جلسه‌ها" section. Pulls the same
 * /meetings/history endpoint used by StatsGrid; renders one card per row
 * with a "مشاهدهٔ جزئیات" button that opens MeetingDetailsModal.
 *
 * We re-fetch when `refreshKey` changes so a fresh meeting creation
 * updates the list without a hard reload.
 */
export function HistoryList({ refreshKey = 0 }: { refreshKey?: number }) {
  const [items, setItems] = useState<MeetingHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiClient.get<MeetingHistoryItem[]>('/meetings/history');
      setItems(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'بارگذاری تاریخچه با خطا مواجه شد.');
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (error) return <Alert variant="error">{error}</Alert>;

  if (items === null) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-slate-100/50 dark:border-slate-800 dark:bg-slate-800/40"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        <HistoryIcon className="mx-auto h-6 w-6 text-slate-400" />
        <p className="mt-2">{t.history.empty}</p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {items.map((m) => (
          <li
            key={m.id}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-brand-200 hover:shadow-sm md:flex-row md:items-center md:justify-between dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-800"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {m.title}
                </h3>
                <StatusBadge status={m.status} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {formatDateTimeFa(m.startedAt ?? m.createdAt)}
                </span>
                <span>
                  {t.history.duration}: {formatDurationFa(m.durationSeconds)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {toFa(m.participantCount)} {t.history.participants}
                  {m.guestCount > 0 && (
                    <span className="opacity-75">
                      {' '}
                      · {toFa(m.guestCount)} {t.history.guests}
                    </span>
                  )}
                </span>
              </div>
            </div>
            <div className="shrink-0">
              <Button variant="secondary" size="sm" onClick={() => setOpenSlug(m.slug)}>
                {t.history.cta}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <MeetingDetailsModal slug={openSlug} onClose={() => setOpenSlug(null)} />
    </>
  );
}

function StatusBadge({ status }: { status: MeetingStatus }) {
  const tone: Record<MeetingStatus, string> = {
    SCHEDULED:
      'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-900/60',
    LIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-900/60',
    ENDED:
      'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
    CANCELLED:
      'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:ring-rose-900/60',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${tone[status]}`}
    >
      {t.history.statuses[status]}
    </span>
  );
}
