import type {
  ParticipantRole,
  ParticipantState,
  ParticipantType,
} from '@meetino/shared';

interface Props {
  participants: ParticipantState[];
  /** participantId of the local user, for the "(شما)" label. */
  meId: string | null;
  /** Phase 7 — show the kick button on every non-host, non-self row. */
  canKick?: boolean;
  /** Called when the host clicks the kick button on a row. */
  onKick?: (participant: ParticipantState) => void;
}

const ROLE_LABEL: Record<ParticipantRole, string> = {
  HOST: 'میزبان',
  STUDENT: 'شرکت‌کننده',
  GUEST: 'مهمان',
};

const TYPE_LABEL: Record<ParticipantType, string> = {
  REGISTERED: 'کاربر',
  GUEST: 'مهمان',
};

/**
 * Live roster panel. Pure presentational — driven entirely by the realtime
 * hook upstream. Hosts get a small chip so they're easy to spot in the list.
 */
export function ParticipantList({ participants, meId, canKick = false, onKick }: Props) {
  const sorted = [...participants].sort(sortByRoleThenName);

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      aria-label="فهرست شرکت‌کنندگان"
    >
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">
          شرکت‌کنندگان
        </h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {participants.length}
        </span>
      </header>

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">هیچ‌کس آنلاین نیست.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((p) => (
            <ParticipantRow
              key={p.participantId}
              p={p}
              isMe={p.participantId === meId}
              canKick={canKick && p.participantId !== meId && p.role !== 'HOST'}
              onKick={onKick ? () => onKick(p) : undefined}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function sortByRoleThenName(a: ParticipantState, b: ParticipantState): number {
  // HOST first, then STUDENT, then GUEST; alphabetical inside each bucket.
  const order: Record<ParticipantRole, number> = { HOST: 0, STUDENT: 1, GUEST: 2 };
  if (order[a.role] !== order[b.role]) return order[a.role] - order[b.role];
  return a.displayName.localeCompare(b.displayName, 'fa');
}

function ParticipantRow({
  p,
  isMe,
  canKick,
  onKick,
}: {
  p: ParticipantState;
  isMe: boolean;
  canKick?: boolean;
  onKick?: () => void;
}) {
  return (
    <li
      className={[
        'flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors',
        p.isOnline
          ? 'border-slate-200 bg-white'
          : 'border-slate-100 bg-slate-50 opacity-70',
      ].join(' ')}
    >
      <Avatar name={p.displayName} online={p.isOnline} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium text-slate-900">
            {p.displayName}
          </span>
          {isMe && <span className="text-xs text-slate-500">(شما)</span>}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
          <span>{ROLE_LABEL[p.role]}</span>
          <span aria-hidden>•</span>
          <span>{TYPE_LABEL[p.type]}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5" aria-label="وضعیت میکروفون و دوربین">
        <StateChip
          label="میکروفون"
          on={p.micEnabled}
          onIcon={<MicOnIcon />}
          offIcon={<MicOffIcon />}
        />
        <StateChip
          label="دوربین"
          on={p.cameraEnabled}
          onIcon={<CamOnIcon />}
          offIcon={<CamOffIcon />}
        />
        {canKick && onKick && (
          <button
            type="button"
            onClick={onKick}
            title="حذف از جلسه"
            aria-label={`حذف ${p.displayName}`}
            className="grid h-7 w-7 place-items-center rounded-lg text-rose-600 transition hover:bg-rose-50"
          >
            <KickIcon />
          </button>
        )}
      </div>
    </li>
  );
}

function KickIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c1-3.6 3.4-5.5 6-5.5s5 1.9 6 5.5" />
      <path d="M16 9l5 5M21 9l-5 5" strokeLinecap="round" />
    </svg>
  );
}

function Avatar({ name, online }: { name: string; online: boolean }) {
  const initial = name.trim().charAt(0).toUpperCase() || '؟';
  return (
    <div className="relative">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800">
        {initial}
      </div>
      <span
        className={[
          'absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white',
          online ? 'bg-emerald-500' : 'bg-slate-300',
        ].join(' ')}
        aria-hidden
      />
    </div>
  );
}

function StateChip({
  label,
  on,
  onIcon,
  offIcon,
}: {
  label: string;
  on: boolean;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
}) {
  return (
    <span
      title={`${label}: ${on ? 'روشن' : 'خاموش'}`}
      className={[
        'grid h-7 w-7 place-items-center rounded-lg',
        on ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
      ].join(' ')}
    >
      {on ? onIcon : offIcon}
    </span>
  );
}

// ── Inline icons (no external dependency, keeps offline-friendly) ──

function MicOnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
function MicOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M3 3l18 18M9 9v2a3 3 0 0 0 5.12 2.12M15 9V6a3 3 0 0 0-5.66-1.43" />
      <path d="M5 11a7 7 0 0 0 11.07 5.74M19 11a7 7 0 0 1-.21 1.74M12 18v3" />
    </svg>
  );
}
function CamOnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <rect x="3" y="7" width="13" height="10" rx="2" />
      <path d="M16 11l5-3v8l-5-3" />
    </svg>
  );
}
function CamOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M3 3l18 18" />
      <path d="M16 11l5-3v8l-5-3" />
      <path d="M3 7v10a2 2 0 0 0 2 2h9" />
    </svg>
  );
}
