import type { Metadata, Viewport } from 'next';
import './globals.css';
import {
  ThemeProvider,
  THEME_BOOTSTRAP_SCRIPT,
} from '@/components/theme/ThemeProvider';

export const metadata: Metadata = {
  title: {
    default: 'میتینو | پلتفرم جلسات آنلاین آکادمی ایرنو',
    template: '%s | میتینو',
  },
  description:
    'میتینو، پلتفرم جلسات ویدیویی و کلاس‌های آنلاین آکادمی ایرنو — ساخته‌شده برای ایران، با میزبانی داخلی و کیفیت بالا.',
  applicationName: 'Meetino',
  referrer: 'strict-origin-when-cross-origin',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#1d36dc',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        {/*
          Phase 7.5 — runs synchronously before React paints to apply the
          stored / system theme to <html>. Without this, dark-mode users
          see a brief light flash on every navigation.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
