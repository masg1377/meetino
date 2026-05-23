'use client';
import { useEffect, useState } from 'react';
import {
  Activity,
  CalendarCheck,
  Clock,
  Hourglass,
  ListChecks,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';
import type { MeetingStatsDto } from '@meetino/shared';
import { apiClient, ApiError } from '@/lib/api-client';
import { Alert } from '@/components/ui/Alert';
import { t } from '@/lib/i18n';
import { formatDurationFa, toFa } from '@/lib/format';

/**
 * Phase 7.6 — read-only analytics widget rendered at the top of the
 * dashboard. Loads /meetings/stats/me once on mount, re-fetches when
 * `refreshKey` changes (so creating a meeting bumps the numbers).
 */
export function StatsGrid({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<MeetingStatsDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    apiClient
      .get<MeetingStatsDto>('/meetings/stats/me')
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof ApiError ? err.message : t.dashboardStats.loading);
      });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  if (error) return <Alert variant="error">{error}</Alert>;

  if (!data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-100/60 dark:border-slate-800 dark:bg-slate-800/40"
          />
        ))}
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {t.dashboardStats.title}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t.dashboardStats.subtitle}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={<ListChecks className="h-4 w-4" />}
          label={t.dashboardStats.cards.totalMeetings}
          value={toFa(data.totalMeetings)}
        />
        <StatTile
          icon={<CalendarCheck className="h-4 w-4" />}
          label={t.dashboardStats.cards.endedMeetings}
          value={toFa(data.endedMeetings)}
        />
        <StatTile
          icon={<Activity className="h-4 w-4 text-emerald-500" />}
          label={t.dashboardStats.cards.activeMeetings}
          value={toFa(data.activeMeetings)}
          accent={data.activeMeetings > 0 ? 'emerald' : 'default'}
        />
        <StatTile
          icon={<Clock className="h-4 w-4" />}
          label={t.dashboardStats.cards.totalDuration}
          value={formatDurationFa(data.totalDurationSeconds)}
        />
        <StatTile
          icon={<Hourglass className="h-4 w-4" />}
          label={t.dashboardStats.cards.averageDuration}
          value={formatDurationFa(data.averageDurationSeconds)}
        />
        <StatTile
          icon={<Users className="h-4 w-4" />}
          label={t.dashboardStats.cards.totalParticipants}
          value={toFa(data.totalParticipants)}
        />
        <StatTile
          icon={<UserPlus className="h-4 w-4" />}
          label={t.dashboardStats.cards.totalGuests}
          value={toFa(data.totalGuests)}
        />
        <StatTile
          icon={<Video className="h-4 w-4" />}
          label={t.dashboardStats.cards.totalMeetings}
          value={toFa(data.recentMeetings.length)}
          subdued
        />
      </div>
    </section>
  );
}

function StatTile({
  icon,
  label,
  value,
  accent = 'default',
  subdued = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: 'default' | 'emerald';
  subdued?: boolean;
}) {
  const ring =
    accent === 'emerald'
      ? 'ring-1 ring-emerald-200 dark:ring-emerald-900/50'
      : 'ring-1 ring-slate-100 dark:ring-slate-800';
  return (
    <div
      className={`rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md ${ring} dark:bg-slate-900 ${
        subdued ? 'opacity-80' : ''
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums dark:text-white">
        {value}
      </div>
    </div>
  );
}
