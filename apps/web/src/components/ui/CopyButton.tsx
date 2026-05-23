'use client';
import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyToClipboard } from '@/lib/copy';

interface CopyButtonProps {
  value: string;
  /** Label shown when idle. */
  label?: string;
  /** Label shown for a moment after a successful copy. */
  copiedLabel?: string;
  /** Visual variant. `subtle` blends into a card; `filled` pops. */
  variant?: 'subtle' | 'filled';
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Reusable copy-to-clipboard button with built-in success feedback.
 * Used wherever a meeting link / slug is displayed.
 */
export function CopyButton({
  value,
  label = 'کپی',
  copiedLabel = 'کپی شد',
  variant = 'subtle',
  size = 'sm',
  className = '',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const handle = async () => {
    const ok = await copyToClipboard(value);
    if (ok) setCopied(true);
  };

  const sizeCls = size === 'md' ? 'h-10 px-4 text-sm' : 'h-9 px-3 text-xs';
  const variantCls =
    variant === 'filled'
      ? 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600 dark:bg-brand-500 dark:hover:bg-brand-400'
      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

  return (
    <button
      type="button"
      onClick={handle}
      className={[
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        sizeCls,
        variantCls,
        className,
      ].join(' ')}
      aria-live="polite"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
}
