'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  LockKeyhole,
  Mic,
  MicOff,
  ShieldCheck,
  Video,
  VideoOff,
} from 'lucide-react';
import type {
  GuestJoinRequest,
  JoinMeetingResponse,
  PublicMeetingDto,
} from '@meetino/shared';
import { apiClient, ApiError } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { useMediaPreview } from '@/hooks/useMediaPreview';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Alert } from '@/components/ui/Alert';
import { MediaControlButton } from '@/components/meeting/MediaControlButton';

const guestSchema = z.object({
  displayName: z
    .string()
    .min(2, 'نام شما باید حداقل ۲ کاراکتر باشد')
    .max(120, 'نام نمی‌تواند بیشتر از ۱۲۰ کاراکتر باشد'),
  password: z.string().max(64).optional(),
});
type GuestForm = z.infer<typeof guestSchema>;

const statusLabel: Record<PublicMeetingDto['status'], string> = {
  SCHEDULED: 'برنامه‌ریزی‌شده',
  LIVE: 'در حال برگزاری',
  ENDED: 'پایان‌یافته',
  CANCELLED: 'لغو شده',
};

export default function PrejoinPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const router = useRouter();
  const { user, isAuthenticated, isHydrated } = useAuth();

  const [meeting, setMeeting] = useState<PublicMeetingDto | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const media = useMediaPreview();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Attach the preview stream to the <video> element.
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = media.stream;
    }
  }, [media.stream]);

  // Public lookup of meeting metadata.
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.get<PublicMeetingDto>(`/meetings/public/${slug}`, {
          skipAuth: true,
        });
        if (!cancelled) setMeeting(data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setLookupError('این جلسه پیدا نشد یا لینک شما معتبر نیست.');
        } else {
          setLookupError(err instanceof ApiError ? err.message : 'خطا در بارگذاری اطلاعات جلسه.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const isMeetingClosed = meeting?.status === 'ENDED' || meeting?.status === 'CANCELLED';
  const isLocked = !!meeting?.isLocked;
  const hasPassword = !!meeting?.hasPassword;
  const guestBlockedByLock = isLocked && !isAuthenticated;

  // Registered-user password input (when meeting.hasPassword).
  const [registeredPassword, setRegisteredPassword] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GuestForm>({ resolver: zodResolver(guestSchema) });

  /**
   * Snapshot the user's pre-join mic/camera intent right before navigating
   * to the room. The room reads these keys and auto-publishes accordingly,
   * so flipping mic/cam OFF in pre-join now actually keeps them off after
   * join (previously they always reset to off).
   */
  const persistMediaIntent = () => {
    try {
      window.localStorage.setItem('meetino:prejoin:mic', media.micEnabled ? 'on' : 'off');
      window.localStorage.setItem('meetino:prejoin:camera', media.cameraEnabled ? 'on' : 'off');
    } catch {
      // private mode / storage disabled — silently ignore
    }
  };

  const handleRegisteredJoin = async () => {
    setActionError(null);
    setBusy(true);
    try {
      const body = hasPassword ? { password: registeredPassword } : undefined;
      await apiClient.post<JoinMeetingResponse>(`/meetings/${slug}/join`, body);
      persistMediaIntent();
      media.stop();
      router.push(`/m/${slug}/room`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'پیوستن به جلسه با خطا مواجه شد.');
    } finally {
      setBusy(false);
    }
  };

  const handleGuestJoin = async (values: GuestForm) => {
    setActionError(null);
    try {
      const body: GuestJoinRequest = {
        displayName: values.displayName,
        password: hasPassword ? values.password : undefined,
      };
      await apiClient.post<JoinMeetingResponse>(`/meetings/${slug}/guest-join`, body, {
        skipAuth: true,
      });
      persistMediaIntent();
      media.stop();
      router.push(`/m/${slug}/room`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'پیوستن به جلسه با خطا مواجه شد.');
    }
  };

  // ── Render shell ──────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppHeader
        rightSlot={
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              بازگشت
            </Button>
          </Link>
        }
      />

      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        {lookupError ? (
          <div className="mx-auto max-w-md">
            <Alert variant="error">{lookupError}</Alert>
            <div className="mt-6 text-center">
              <Link href="/" className="text-sm text-brand-700 hover:text-brand-800">
                بازگشت به صفحه اصلی
              </Link>
            </div>
          </div>
        ) : !meeting || !isHydrated ? (
          <div className="grid place-items-center py-20">
            <div
              className="h-10 w-10 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"
              aria-label="در حال بارگذاری"
            />
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            {/* ── Camera preview ─────────────────────────────────── */}
            <div>
              <div className="relative aspect-video overflow-hidden rounded-3xl bg-slate-900 shadow-xl">
                {media.stream && media.cameraEnabled ? (
                  <video
                    ref={videoRef}
                    className="h-full w-full -scale-x-100 object-cover"
                    autoPlay
                    muted
                    playsInline
                  />
                ) : (
                  <CameraOffPlaceholder
                    name={user?.displayName ?? 'شما'}
                    note={
                      media.status === 'requesting'
                        ? 'در حال درخواست اجازه از مرورگر…'
                        : media.status === 'denied'
                          ? 'دسترسی به دوربین رد شد. می‌توانید بدون دوربین وارد جلسه شوید.'
                          : media.status === 'not-found'
                            ? 'دوربینی پیدا نشد. می‌توانید بدون دوربین وارد شوید.'
                            : !media.cameraEnabled
                              ? 'دوربین خاموش است'
                              : 'در حال آماده‌سازی پیش‌نمایش…'
                    }
                  />
                )}

                {/* Controls overlay */}
                <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-3">
                  <MediaControlButton
                    active={media.micEnabled}
                    iconOn={<Mic className="h-5 w-5" />}
                    iconOff={<MicOff className="h-5 w-5" />}
                    label={media.micEnabled ? 'بستن میکروفون' : 'باز کردن میکروفون'}
                    onClick={() => void media.toggleMic()}
                  />
                  <MediaControlButton
                    active={media.cameraEnabled}
                    iconOn={<Video className="h-5 w-5" />}
                    iconOff={<VideoOff className="h-5 w-5" />}
                    label={media.cameraEnabled ? 'بستن دوربین' : 'باز کردن دوربین'}
                    onClick={() => void media.toggleCamera()}
                  />
                </div>
              </div>

              {media.errorMessage && (
                <div className="mt-4">
                  <Alert variant="info">{media.errorMessage}</Alert>
                </div>
              )}

              <p className="mt-4 text-center text-xs text-slate-500">
                اولین بار که میکروفون یا دوربین را روشن می‌کنید، مرورگر اجازه دسترسی می‌خواهد.
              </p>
            </div>

            {/* ── Info + join form ────────────────────────────────── */}
            <div>
              <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-100">
                {statusLabel[meeting.status]}
              </span>
              <h1 className="mt-3 text-2xl font-bold text-slate-900 md:text-3xl">
                {meeting.title}
              </h1>
              <p className="mt-1.5 text-sm text-slate-600">
                میزبان:{' '}
                <span className="font-medium text-slate-800">{meeting.hostDisplayName}</span>
              </p>

              {(isLocked || hasPassword) && !isMeetingClosed && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {isLocked && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                      <LockKeyhole className="h-3.5 w-3.5" />
                      قفل
                    </span>
                  )}
                  {hasPassword && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      نیاز به رمز
                    </span>
                  )}
                </div>
              )}

              <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                {isMeetingClosed ? (
                  <Alert variant="info">
                    🎬 این جلسه پایان یافته است و دیگر قابل پیوستن نیست.
                  </Alert>
                ) : guestBlockedByLock ? (
                  <div className="space-y-4">
                    <Alert variant="info">
                      🔒 این جلسه قفل است. برای ورود باید با حساب کاربری وارد شوید یا منتظر بمانید تا میزبان قفل را باز کند.
                    </Alert>
                    <p className="text-center text-sm text-slate-500">
                      حساب دارید؟{' '}
                      <Link
                        href={`/login?next=/m/${slug}/prejoin`}
                        className="font-medium text-brand-700 hover:text-brand-800"
                      >
                        ورود به حساب کاربری
                      </Link>
                    </p>
                  </div>
                ) : isAuthenticated && user ? (
                  <RegisteredJoinPanel
                    userName={user.displayName}
                    onJoin={handleRegisteredJoin}
                    busy={busy}
                    error={actionError}
                    hasPassword={hasPassword}
                    password={registeredPassword}
                    onPasswordChange={setRegisteredPassword}
                    isLocked={isLocked}
                  />
                ) : (
                  <GuestJoinPanel
                    onSubmit={handleSubmit(handleGuestJoin)}
                    register={register}
                    errors={errors}
                    isSubmitting={isSubmitting}
                    error={actionError}
                    slug={slug}
                    hasPassword={hasPassword}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function CameraOffPlaceholder({ name, note }: { name: string; note: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '؟';
  return (
    <div className="grid h-full w-full place-items-center text-center text-white">
      <div>
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-white/10 text-3xl font-semibold">
          {initial}
        </div>
        <p className="mt-4 text-sm text-white/70">{note}</p>
      </div>
    </div>
  );
}

function RegisteredJoinPanel({
  userName,
  onJoin,
  busy,
  error,
  hasPassword,
  password,
  onPasswordChange,
  isLocked,
}: {
  userName: string;
  onJoin: () => void;
  busy: boolean;
  error: string | null;
  hasPassword: boolean;
  password: string;
  onPasswordChange: (v: string) => void;
  isLocked: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
        با حساب کاربری{' '}
        <span className="font-medium text-slate-900">{userName}</span> وارد جلسه می‌شوید.
      </div>

      {isLocked && (
        <Alert variant="info">
          🔒 این جلسه قفل است. اگر میزبان یا مدیر هستید، می‌توانید وارد شوید؛ در غیر این صورت ورود رد می‌شود.
        </Alert>
      )}

      {hasPassword && (
        <FormField label="رمز عبور جلسه" htmlFor="password">
          <Input
            id="password"
            type="password"
            placeholder="رمز عبور"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
          />
        </FormField>
      )}

      {error && <Alert variant="error">{error}</Alert>}
      <Button size="lg" className="w-full" onClick={onJoin} disabled={busy}>
        {busy ? 'در حال پیوستن…' : 'پیوستن به جلسه'}
      </Button>
    </div>
  );
}

interface GuestPanelProps {
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  register: ReturnType<typeof useForm<GuestForm>>['register'];
  errors: ReturnType<typeof useForm<GuestForm>>['formState']['errors'];
  isSubmitting: boolean;
  error: string | null;
  slug: string;
  hasPassword: boolean;
}

function GuestJoinPanel({
  onSubmit,
  register,
  errors,
  isSubmitting,
  error,
  slug,
  hasPassword,
}: GuestPanelProps) {
  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}

      <FormField label="نام شما" htmlFor="displayName" error={errors.displayName?.message}>
        <Input
          id="displayName"
          placeholder="مثلاً سارا"
          autoFocus
          invalid={!!errors.displayName}
          {...register('displayName')}
        />
      </FormField>

      {hasPassword && (
        <FormField label="رمز عبور جلسه" htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            placeholder="رمز عبور"
            invalid={!!errors.password}
            {...register('password')}
          />
        </FormField>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'در حال پیوستن…' : 'پیوستن به‌عنوان مهمان'}
      </Button>

      <p className="text-center text-sm text-slate-500">
        حساب دارید؟{' '}
        <Link
          href={`/login?next=/m/${slug}/prejoin`}
          className="font-medium text-brand-700 hover:text-brand-800"
        >
          ورود به حساب کاربری
        </Link>
      </p>
    </form>
  );
}
