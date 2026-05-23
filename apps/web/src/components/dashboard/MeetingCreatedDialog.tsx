'use client';
import Link from 'next/link';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import type { MeetingDto } from '@meetino/shared';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { buildMeetingUrl } from '@/lib/copy';

interface Props {
  meeting: MeetingDto | null;
  onClose: () => void;
}

export function MeetingCreatedDialog({ meeting, onClose }: Props) {
  if (!meeting) return null;
  const url = buildMeetingUrl(meeting.slug);

  return (
    <Modal
      open={!!meeting}
      onClose={onClose}
      title="جلسه ساخته شد"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose}>
            بستن
          </Button>
          <Link href={`/m/${meeting.slug}`}>
            <Button variant="primary" size="md">
              <ExternalLink className="h-4 w-4" />
              ورود به جلسه
            </Button>
          </Link>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 ring-1 ring-inset ring-emerald-200">
        <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
        <div>
          <p className="text-sm font-medium text-emerald-900">جلسه شما آماده است.</p>
          <p className="mt-1 text-xs leading-6 text-emerald-800/80">
            لینک زیر را برای شرکت‌کنندگان ارسال کنید — هر کسی با لینک می‌تواند
            به‌عنوان مهمان وارد جلسه شود.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <label className="block text-sm font-medium text-slate-800">لینک جلسه</label>
        <div className="flex items-stretch gap-2">
          <div
            dir="ltr"
            className="flex flex-1 items-center truncate rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800"
          >
            {url}
          </div>
          <CopyButton value={url} variant="filled" size="md" />
        </div>
      </div>

      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50/60 p-3">
          <dt className="text-xs text-slate-500">عنوان</dt>
          <dd className="mt-0.5 truncate font-medium text-slate-900">{meeting.title}</dd>
        </div>
        <div className="rounded-xl bg-slate-50/60 p-3">
          <dt className="text-xs text-slate-500">کد جلسه</dt>
          <dd className="mt-0.5 font-mono text-slate-900" dir="ltr">
            {meeting.slug}
          </dd>
        </div>
      </dl>
    </Modal>
  );
}
