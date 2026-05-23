'use client';
import { useState, useRef, useEffect } from 'react';
import type { PublicUser } from '@meetino/shared';
import { useAuth } from '@/hooks/useAuth';

const roleLabel: Record<PublicUser['role'], string> = {
  ADMIN: 'مدیر',
  HOST: 'مدرس',
  STUDENT: 'کاربر',
};

export function UserMenu({ user }: { user: PublicUser }) {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const initials = user.displayName
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white dark:bg-brand-500">
          {initials || '?'}
        </span>
        <span className="hidden text-start md:block">
          <span className="block text-sm font-medium text-slate-900 dark:text-white">
            {user.displayName}
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            {roleLabel[user.role]}
          </span>
        </span>
      </button>

      {open && (
        <div className="absolute end-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
              {user.displayName}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400" dir="ltr">
              {user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
            className="block w-full px-4 py-2.5 text-start text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
          >
            خروج از حساب
          </button>
        </div>
      )}
    </div>
  );
}
