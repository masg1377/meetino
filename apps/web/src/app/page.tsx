import Link from 'next/link';
import {
  ArrowLeft,
  MessageSquare,
  MonitorUp,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AppHeader } from '@/components/layout/AppHeader';
import { Logo } from '@/components/Logo';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <AppHeader
        nav={[
          { href: '#features', label: 'امکانات' },
          { href: '#about', label: 'دربارهٔ ایرنو' },
        ]}
        variant="transparent"
        rightSlot={
          <>
            <Link href="/login">
              <Button variant="ghost" size="sm">
                ورود
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="primary" size="sm">
                ثبت‌نام
              </Button>
            </Link>
          </>
        }
      />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 left-10 h-72 w-72 rounded-full bg-brand-100/60 blur-3xl"
        />

        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-16 md:pt-24">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-100 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                ساخته‌شده برای آکادمی ایرنو
              </span>

              <h1 className="mt-5 text-balance text-4xl font-bold leading-[1.18] text-slate-900 md:text-5xl">
                جلسهٔ ویدیویی شما، ساده و حرفه‌ای.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
                میتینو پلتفرم خودمیزبان جلسات و کلاس‌های آنلاین است؛ بدون
                وابستگی به سرویس‌های خارجی، طراحی‌شده برای کاربران ایرانی و
                دانش‌آموزان آکادمی ایرنو.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/register">
                  <Button variant="primary" size="lg">
                    شروع رایگان
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="secondary" size="lg">
                    ورود به حساب
                  </Button>
                </Link>
              </div>

              <p className="mt-5 text-sm text-slate-500">
                برای پیوستن به جلسه نیاز به ثبت‌نام ندارید — کافی است لینک جلسه
                را باز کنید.
              </p>
            </div>

            {/* Decorative hero panel — meeting-grid mock */}
            <div className="relative">
              <div className="absolute inset-0 -translate-y-3 translate-x-3 rounded-[28px] bg-brand-100/60 blur-2xl" />
              <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-slate-900 p-3 shadow-2xl">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: 'استاد رضایی', tone: 'from-indigo-500 to-brand-600', mic: true },
                    { name: 'سارا م.', tone: 'from-emerald-500 to-teal-600', mic: true },
                    { name: 'علی ر.', tone: 'from-amber-500 to-orange-600', mic: false },
                    { name: 'شما', tone: 'from-rose-500 to-pink-600', mic: true },
                  ].map((p) => (
                    <div
                      key={p.name}
                      className={`relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-br ${p.tone}`}
                    >
                      <div className="absolute inset-x-2 bottom-2 flex items-center justify-between rounded-lg bg-black/40 px-2 py-1 text-[11px] text-white backdrop-blur-sm">
                        <span className="truncate">{p.name}</span>
                        <span className={p.mic ? 'opacity-100' : 'opacity-50'}>🎙️</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-slate-800/70 px-3 py-2">
                  {['🎙️', '📷', '🖥️', '💬', '👥'].map((emoji, i) => (
                    <button
                      key={i}
                      className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-base text-white transition hover:bg-white/20"
                      type="button"
                      aria-hidden
                      tabIndex={-1}
                    >
                      {emoji}
                    </button>
                  ))}
                  <span className="mx-1 h-6 w-px bg-white/15" aria-hidden />
                  <button
                    className="grid h-9 w-9 place-items-center rounded-full bg-rose-600 text-base text-white hover:bg-rose-700"
                    type="button"
                    aria-hidden
                    tabIndex={-1}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section
        id="features"
        className="border-t border-slate-200 bg-white py-20 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-900 md:text-4xl dark:text-white">
              ساده، حرفه‌ای، خودمیزبان
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600 dark:text-slate-400">
              همهٔ ابزارهای یک کلاس یا جلسهٔ آنلاین، بدون نیاز به نصب نرم‌افزار
              و بدون وابستگی به سرویس‌های خارجی.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                title: 'پیوستن به‌عنوان مهمان',
                desc: 'دانش‌آموزان و مهمانان فقط با لینک جلسه و وارد کردن نام وارد کلاس می‌شوند.',
                Icon: UserCheck,
              },
              {
                title: 'ویدیو و صدای باکیفیت',
                desc: 'مبتنی بر WebRTC با سرور SFU خودمیزبان برای کیفیت پایدار حتی روی اینترنت داخلی.',
                Icon: Video,
              },
              {
                title: 'اشتراک‌گذاری صفحه',
                desc: 'برای تدریس، ارائه و آموزش گام‌به‌گام، اشتراک صفحه با یک کلیک.',
                Icon: MonitorUp,
              },
              {
                title: 'چت داخل جلسه',
                desc: 'پرسش و پاسخ، اشتراک لینک و گفتگوی متنی در کنار تماس تصویری.',
                Icon: MessageSquare,
              },
              {
                title: 'کنترل میزبان',
                desc: 'قفل جلسه، حذف شرکت‌کننده، رمز عبور و پایان جلسه در اختیار میزبان.',
                Icon: ShieldCheck,
              },
              {
                title: 'طراحی راست‌چین',
                desc: 'رابط کاربری کاملاً فارسی و راست‌چین، آماده برای پشتیبانی چندزبانه در آینده.',
                Icon: Sparkles,
              },
            ].map(({ title, desc, Icon }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-brand-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-brand-800"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About ── */}
      <section id="about" className="bg-slate-50 py-20 dark:bg-slate-950">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-2xl font-bold text-slate-900 md:text-3xl dark:text-white">
            ساخته‌شده برای آکادمی ایرنو
          </h2>
          <p className="mt-4 leading-8 text-slate-600 dark:text-slate-400">
            میتینو پلتفرم رسمی جلسات و کلاس‌های آنلاین آکادمی ایرنو است؛ آکادمی
            آموزشی فعال در زمینهٔ توسعهٔ وب، هوش مصنوعی، زبان و مهارت‌های دیجیتال.
            هدف ما ابزاری ساده، پایدار و قابل اتکا برای مدرسان و دانش‌آموزان ایرانی است.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register">
              <Button variant="primary" size="lg">
                ساخت حساب کاربری
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" size="lg">
                ورود به حساب
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-white py-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <Logo />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} میتینو · آکادمی ایرنو
          </p>
        </div>
      </footer>
    </main>
  );
}
