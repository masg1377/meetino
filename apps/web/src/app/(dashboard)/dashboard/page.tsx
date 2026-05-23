'use client';
import { useState } from 'react';
import { Mail, Plus, ShieldCheck, UserRound, Video } from 'lucide-react';
import type { MeetingDto } from '@meetino/shared';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { CreateMeetingModal } from '@/components/dashboard/CreateMeetingModal';
import { MeetingCreatedDialog } from '@/components/dashboard/MeetingCreatedDialog';
import { MeetingsList } from '@/components/dashboard/MeetingsList';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { HistoryList } from '@/components/dashboard/HistoryList';
import { t } from '@/lib/i18n';

const roleLabel = {
  ADMIN: 'مدیر',
  HOST: 'مدرس',
  STUDENT: 'کاربر',
} as const;

export default function DashboardPage() {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [justCreated, setJustCreated] = useState<MeetingDto | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  if (!user) return null;

  return (
    <div className="space-y-10">
      {/* ── Hero: greeting + primary CTA ───────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 left-0 h-56 w-56 rounded-full bg-brand-100/60 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-12 -right-16 h-56 w-56 rounded-full bg-brand-200/30 blur-3xl"
        />

        <div className="relative flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-100 dark:bg-brand-900/40 dark:text-brand-200 dark:ring-brand-900/60">
              <Video className="h-3.5 w-3.5" />
              داشبورد میتینو
            </span>
            <h1 className="mt-4 text-2xl font-bold text-slate-900 md:text-3xl dark:text-white">
              سلام، {user.displayName} 👋
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-400">
              جلسه‌ای بسازید، لینک را برای شرکت‌کنندگان بفرستید و میزبان جلسه باشید.
            </p>
          </div>
          <div className="shrink-0">
            <Button size="lg" onClick={() => setCreateOpen(true)}>
              <Plus className="h-5 w-5" />
              ایجاد جلسه جدید
            </Button>
          </div>
        </div>
      </section>

      {/* ── Phase 7.6 — analytics ──────────────────────────────────── */}
      <StatsGrid refreshKey={refreshKey} />

      {/* ── Meetings list ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">جلسات من</h2>
        </header>
        <MeetingsList refreshKey={refreshKey} onCreateClick={() => setCreateOpen(true)} />
      </section>

      {/* ── Phase 7.6 — recent meetings + details modal ────────────── */}
      <section className="space-y-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t.history.title}
          </h2>
        </header>
        <HistoryList refreshKey={refreshKey} />
      </section>

      {/* ── Account summary ────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">اطلاعات حساب</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoTile icon={<UserRound className="h-4 w-4" />} label="نام نمایشی" value={user.displayName} />
          <InfoTile
            icon={<Mail className="h-4 w-4" />}
            label="ایمیل"
            value={<span dir="ltr">{user.email}</span>}
          />
          <InfoTile icon={<ShieldCheck className="h-4 w-4" />} label="نقش" value={roleLabel[user.role]} />
          <InfoTile
            icon={<Video className="h-4 w-4" />}
            label="عضو از"
            value={new Date(user.createdAt).toLocaleDateString('fa-IR')}
          />
        </dl>
      </section>

      {/* Modals */}
      <CreateMeetingModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(meeting) => {
          setCreateOpen(false);
          setJustCreated(meeting);
          setRefreshKey((k) => k + 1);
        }}
      />
      <MeetingCreatedDialog meeting={justCreated} onClose={() => setJustCreated(null)} />
    </div>
  );
}

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
      <dt className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        {icon}
        {label}
      </dt>
      <dd className="mt-1.5 text-sm font-medium text-slate-900 dark:text-white">{value}</dd>
    </div>
  );
}
