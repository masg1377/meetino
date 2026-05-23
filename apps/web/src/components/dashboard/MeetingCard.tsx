'use client';
import Link from 'next/link';
import {
  CalendarDays,
  ExternalLink,
  LockKeyhole,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import type { MeetingDto } from '@meetino/shared';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { buildMeetingUrl } from '@/lib/copy';

const statusLabel: Record<MeetingDto['status'], string> = {
  SCHEDULED: 'برنامه‌ریزی‌شده',
  LIVE: 'در حال برگزاری',
  ENDED: 'پایان‌یافته',
  CANCELLED: 'لغو شده',
};
const statusStyles: Record<MeetingDto['status'], string> = {
  SCHEDULED: 'bg-amber-50 text-amber-800 ring-amber-200',
  LIVE: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  ENDED: 'bg-slate-100 text-slate-600 ring-slate-200',
  CANCELLED: 'bg-rose-50 text-rose-800 ring-rose-200',
};

/**
 * A single meeting in the dashboard list. Designed to be scan-able:
 * title at the top, status chip, link with copy button, and an action.
 */
export function MeetingCard({ meeting }: { meeting: MeetingDto }) {
  const url = buildMeetingUrl(meeting.slug);
  const isClosed = meeting.status === 'ENDED' || meeting.status === 'CANCELLED';

  return (
    <article className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-800">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900 dark:text-white">
            {meeting.title}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <CalendarDays className="h-3.5 w-3.5" />
            {new Date(meeting.createdAt).toLocaleDateString('fa-IR')}
          </p>
        </div>
        <span
          className={[
            'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
            statusStyles[meeting.status],
          ].join(' ')}
        >
          {meeting.status === 'LIVE' && <Radio className="h-3 w-3 animate-pulse" />}
          {statusLabel[meeting.status]}
        </span>
      </header>

      {meeting.description && (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          {meeting.description}
        </p>
      )}

      {(meeting.isLocked || meeting.hasPassword) && !isClosed && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {meeting.isLocked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
              <LockKeyhole className="h-3 w-3" />
              قفل
            </span>
          )}
          {meeting.hasPassword && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
              <ShieldCheck className="h-3 w-3" />
              رمزدار
            </span>
          )}
        </div>
      )}

      <div className="mt-4 flex items-stretch gap-2">
        <code
          dir="ltr"
          className="flex flex-1 items-center truncate rounded-xl bg-slate-50 px-3 font-mono text-xs text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
        >
          {meeting.slug}
        </code>
        <CopyButton value={url} label="کپی لینک" copiedLabel="کپی شد" />
      </div>

      <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        {!isClosed && (
          <Link href={`/m/${meeting.slug}`} className="block">
            <Button variant="primary" size="sm">
              <ExternalLink className="h-4 w-4" />
              ورود به جلسه
            </Button>
          </Link>
        )}
      </div>
    </article>
  );
}
