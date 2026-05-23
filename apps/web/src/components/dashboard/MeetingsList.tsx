'use client';
import { useEffect, useState, useCallback } from 'react';
import { CalendarPlus, Video } from 'lucide-react';
import type { MeetingDto } from '@meetino/shared';
import { apiClient, ApiError } from '@/lib/api-client';
import { MeetingCard } from './MeetingCard';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

interface Props {
  /** Bumped after a new meeting is created to trigger a refetch. */
  refreshKey?: number;
  onCreateClick: () => void;
}

export function MeetingsList({ refreshKey, onCreateClick }: Props) {
  const [meetings, setMeetings] = useState<MeetingDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await apiClient.get<MeetingDto[]>('/meetings/my');
      setMeetings(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'بارگذاری جلسات با خطا مواجه شد.');
      setMeetings([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (meetings === null && !error) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-slate-200 bg-white py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" aria-label="در حال بارگذاری" />
      </div>
    );
  }

  if (error) {
    return <Alert variant="error">{error}</Alert>;
  }

  if (meetings && meetings.length === 0) {
    return (
      <EmptyState
        icon={<Video className="h-7 w-7" />}
        title="هنوز جلسه‌ای ندارید"
        description="اولین جلسه خود را بسازید و لینک آن را با شرکت‌کنندگان به اشتراک بگذارید."
        action={
          <Button onClick={onCreateClick}>
            <CalendarPlus className="h-4 w-4" />
            ساخت اولین جلسه
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {meetings!.map((m) => (
        <MeetingCard key={m.id} meeting={m} />
      ))}
    </div>
  );
}
