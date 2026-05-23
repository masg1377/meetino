import { ConnectionStatus } from '@meetino/shared';

interface Props {
  status: ConnectionStatus;
}

const STYLES: Record<ConnectionStatus, { label: string; cls: string; dotCls: string }> = {
  [ConnectionStatus.CONNECTING]: {
    label: 'در حال اتصال…',
    cls: 'bg-amber-50 text-amber-800 ring-amber-200',
    dotCls: 'bg-amber-400 animate-pulse',
  },
  [ConnectionStatus.CONNECTED]: {
    label: 'متصل',
    cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    dotCls: 'bg-emerald-500',
  },
  [ConnectionStatus.DISCONNECTED]: {
    label: 'قطع شد',
    cls: 'bg-slate-100 text-slate-700 ring-slate-200',
    dotCls: 'bg-slate-400',
  },
  [ConnectionStatus.ERROR]: {
    label: 'خطا در اتصال',
    cls: 'bg-rose-50 text-rose-800 ring-rose-200',
    dotCls: 'bg-rose-500',
  },
};

/**
 * Small badge showing the current realtime connection state. Used in the
 * room header so users can tell at a glance whether they're live.
 */
export function ConnectionBadge({ status }: Props) {
  const s = STYLES[status];
  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset',
        s.cls,
      ].join(' ')}
      aria-live="polite"
    >
      <span className={`h-2 w-2 rounded-full ${s.dotCls}`} aria-hidden />
      {s.label}
    </span>
  );
}
