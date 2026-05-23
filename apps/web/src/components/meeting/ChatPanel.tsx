'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ConnectionStatus,
  MAX_CHAT_BODY_LENGTH,
  type ChatErrorPayload,
  type ChatMessageDto,
  type ParticipantRole,
} from '@meetino/shared';
import { Alert } from '@/components/ui/Alert';

interface Props {
  messages: ChatMessageDto[];
  /** participantId of the local user — used to right-align my bubbles. */
  meId: string | null;
  isHistoryLoading: boolean;
  status: ConnectionStatus;
  chatError: ChatErrorPayload | null;
  onSend: (body: string) => boolean;
  /** Optional — called when the user starts editing so the alert can clear. */
  onClearError?: () => void;
}

const ROLE_BADGE: Record<ParticipantRole, { label: string; cls: string }> = {
  HOST: { label: 'میزبان', cls: 'bg-brand-100 text-brand-800' },
  STUDENT: { label: 'شرکت‌کننده', cls: 'bg-slate-100 text-slate-700' },
  GUEST: { label: 'مهمان', cls: 'bg-amber-100 text-amber-800' },
};

/**
 * In-meeting chat panel. Driven entirely by props from useMeetingSocket.
 *
 * Layout:
 *   ┌─────────────┐
 *   │ header      │
 *   ├─────────────┤
 *   │ scroll list │  ← auto-scrolls to bottom on new message
 *   ├─────────────┤
 *   │ input + btn │
 *   └─────────────┘
 */
export function ChatPanel({
  messages,
  meId,
  isHistoryLoading,
  status,
  chatError,
  onSend,
  onClearError,
}: Props) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Pin-to-bottom on new messages. Skipped if the user has scrolled up,
  // but Phase 5 keeps that detection simple — always pin for now.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, isHistoryLoading]);

  const trimmedLength = draft.trim().length;
  const overLimit = trimmedLength > MAX_CHAT_BODY_LENGTH;
  const canSend =
    !sending &&
    !isHistoryLoading &&
    trimmedLength > 0 &&
    !overLimit &&
    status === ConnectionStatus.CONNECTED;

  const submit = () => {
    if (!canSend) return;
    setSending(true);
    const ok = onSend(draft);
    if (ok) setDraft('');
    // The send is "fire and forget" — the message will appear via the
    // server echo. We re-enable the button immediately; even if the network
    // is slow, the user is allowed to queue another message.
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter = send, Shift+Enter = newline (standard chat ergonomics).
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <section
      // Fills its parent (SidePanel content area). No fixed height — that
      // breaks on small viewports / when the SidePanel itself is short.
      className="flex h-full min-h-0 flex-col bg-white dark:bg-slate-900"
      aria-label="چت جلسه"
    >
      <header className="flex shrink-0 items-baseline justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">چت جلسه</h2>
        <span className="text-xs text-slate-400 dark:text-slate-500">{messages.length} پیام</span>
      </header>

      <div
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto px-5 py-4 min-h-0"
        role="log"
        aria-live="polite"
      >
        {isHistoryLoading ? (
          <ChatSkeleton />
        ) : messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} message={m} isMine={!!meId && m.participantId === meId} />
          ))
        )}
      </div>

      {chatError && (
        <div className="shrink-0 border-t border-slate-100 px-5 py-3">
          <Alert variant="error" onDismiss={onClearError}>
            {chatError.message}
          </Alert>
        </div>
      )}

      <form
        className="shrink-0 border-t border-slate-100 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">
            متن پیام
          </label>
          <textarea
            id="chat-input"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (chatError) onClearError?.();
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="پیام خود را بنویسید…"
            maxLength={MAX_CHAT_BODY_LENGTH + 1 /* allow paste-then-trim */}
            disabled={status !== ConnectionStatus.CONNECTED || isHistoryLoading}
            className={[
              'block max-h-32 min-h-[44px] flex-1 resize-y rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm',
              'focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100',
              'disabled:cursor-not-allowed disabled:bg-slate-50',
              'dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-900',
              overLimit
                ? 'border-rose-300 dark:border-rose-500'
                : 'border-slate-200 dark:border-slate-700',
            ].join(' ')}
            aria-invalid={overLimit || undefined}
          />
          <SendButton disabled={!canSend} />
        </div>
        <div className="mt-1 flex justify-between text-[11px]">
          <span className="text-slate-400">
            Enter برای ارسال — Shift+Enter برای خط جدید
          </span>
          <span className={overLimit ? 'text-rose-600' : 'text-slate-400'}>
            {trimmedLength}/{MAX_CHAT_BODY_LENGTH}
          </span>
        </div>
      </form>
    </section>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function MessageBubble({ message, isMine }: { message: ChatMessageDto; isMine: boolean }) {
  const time = useMemo(() => formatTime(message.createdAt), [message.createdAt]);
  const badge = ROLE_BADGE[message.senderRole];

  return (
    <article className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[80%] rounded-2xl px-3 py-2 shadow-sm',
          isMine ? 'bg-brand-600 text-white' : 'bg-slate-50 text-slate-900',
        ].join(' ')}
      >
        <header className="flex items-baseline gap-2 text-xs">
          <span className={isMine ? 'font-medium text-brand-50' : 'font-medium text-slate-700'}>
            {message.senderDisplayName}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] ${badge.cls}`}>
            {badge.label}
          </span>
          <time className={isMine ? 'text-brand-100' : 'text-slate-400'} dateTime={message.createdAt}>
            {time}
          </time>
        </header>
        <p
          className={[
            'mt-1 whitespace-pre-wrap break-words text-sm leading-6',
            isMine ? 'text-white' : 'text-slate-800',
          ].join(' ')}
        >
          {message.body}
        </p>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="grid h-full place-items-center text-center">
      <div>
        <div className="text-3xl">💬</div>
        <p className="mt-2 text-sm text-slate-500">هنوز پیامی فرستاده نشده.</p>
        <p className="text-xs text-slate-400">اولین پیام را شما بنویسید.</p>
      </div>
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex">
          <div
            className={[
              'h-8 w-1/2 animate-pulse rounded-2xl bg-slate-100',
              i % 2 === 0 ? 'me-auto' : 'ms-auto',
            ].join(' ')}
          />
        </div>
      ))}
    </div>
  );
}

function SendButton({ disabled }: { disabled: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      aria-label="ارسال پیام"
      className={[
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        disabled
          ? 'cursor-not-allowed bg-slate-100 text-slate-400'
          : 'bg-brand-600 text-white hover:bg-brand-700',
      ].join(' ')}
    >
      <SendIcon />
    </button>
  );
}

function SendIcon() {
  return (
    // RTL-friendly: arrow points to the left (forward in fa direction).
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M20 4L4 11l6 2 2 6 8-15z" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Persian-friendly HH:MM. We avoid Intl with locale-specific gotchas here. */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
