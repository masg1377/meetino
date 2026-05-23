import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { AppHeader } from '@/components/layout/AppHeader';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 via-white to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 left-10 h-72 w-72 rounded-full bg-brand-100/60 blur-3xl"
      />

      <AppHeader
        variant="transparent"
        rightSlot={
          <Link href="/">
            <Button variant="ghost" size="sm">
              بازگشت
            </Button>
          </Link>
        }
      />

      <main className="relative flex w-full flex-col items-center px-6 py-16">
        {children}
      </main>
    </div>
  );
}
