'use client';
import type { CSSProperties } from 'react';
import type { LivekitParticipantSnapshot, LivekitStatus } from '@/hooks/useLivekitRoom';
import { VideoTile } from './VideoTile';

interface Props {
  local: LivekitParticipantSnapshot | null;
  remotes: LivekitParticipantSnapshot[];
  status: LivekitStatus;
}

/**
 * Responsive participant grid that ALWAYS fits inside its parent.
 *
 * Two layouts:
 *
 * 1. No screen share — a count-aware grid centered in the stage:
 *      1 tile  → single large tile, capped to a reasonable max width
 *      2 tiles → 2 columns
 *      3-4    → 2 columns × auto rows
 *      5-9    → 3 columns
 *      10+    → 4 columns
 *    Tiles use `min-h-0` cells so the grid never forces overflow.
 *
 * 2. One or more screen shares — Google-Meet-style stage:
 *      - The first share fills the main stage on the inline-end side.
 *      - All other shares + camera tiles render as small thumbnails in a
 *        scrollable strip on the inline-start side (right side in RTL).
 *
 * The container itself takes h-full + min-h-0 from the parent flex; nothing
 * inside ever pushes the stage taller than the viewport.
 */
export function VideoGrid({ local, remotes, status }: Props) {
  const all: LivekitParticipantSnapshot[] = local ? [local, ...remotes] : remotes;
  const screenSharers = all.filter((p) => !!p.screenTrack);

  if (status === 'connecting' || status === 'idle') {
    return <StagePlaceholder text="در حال اتصال به جلسهٔ تصویری…" spinning />;
  }
  if (status === 'error') {
    return <StagePlaceholder text="اتصال تصویری برقرار نشد. می‌توانید چت را همچنان استفاده کنید." />;
  }
  if (status === 'disconnected') {
    return <StagePlaceholder text="از جلسهٔ تصویری خارج شده‌اید." />;
  }
  if (all.length === 0) {
    return (
      <StagePlaceholder text="هیچ‌کس هنوز ویدیو منتشر نکرده. روی دوربین یا میکروفون بزنید تا شروع شود." />
    );
  }

  // ── Screen-share stage layout ──────────────────────────────────────
  if (screenSharers.length > 0) {
    const primaryShare = screenSharers[0];
    const otherShares = screenSharers.slice(1);
    // Thumbnails: all cameras + any additional screen shares.
    const thumbs = [...otherShares.map((p) => ({ p, asScreen: true })), ...all.map((p) => ({ p, asScreen: false }))];

    return (
      <div className="flex h-full min-h-0 gap-3 p-3 sm:p-4">
        {/* Main stage — the first screen share, centered & filling the area. */}
        <div className="grid min-w-0 flex-1 place-items-center">
          <div className="flex aspect-video max-h-full w-full items-stretch overflow-hidden rounded-2xl">
            <VideoTile participant={primaryShare} asScreenShare />
          </div>
        </div>

        {/* Side strip — small thumbnails. Scrollable internally. */}
        <aside className="flex h-full w-40 shrink-0 flex-col gap-2 overflow-y-auto pe-1 sm:w-48">
          {thumbs.map(({ p, asScreen }) => (
            <div
              key={`${asScreen ? 'screen' : 'cam'}-${p.sid || p.identity}`}
              className="aspect-video w-full shrink-0 overflow-hidden rounded-xl"
            >
              <VideoTile participant={p} asScreenShare={asScreen} />
            </div>
          ))}
        </aside>
      </div>
    );
  }

  // ── Plain camera grid — count-aware columns ────────────────────────
  const cols = pickColumns(all.length);
  // Single-tile case: cap the width and center so it doesn't stretch huge.
  if (all.length === 1) {
    return (
      <div className="grid h-full min-h-0 place-items-center p-3 sm:p-4">
        <div className="flex aspect-video w-full max-w-5xl max-h-full items-stretch overflow-hidden rounded-2xl">
          <VideoTile participant={all[0]} />
        </div>
      </div>
    );
  }

  const gridStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridAutoRows: '1fr',
  };

  return (
    <div className="h-full min-h-0 p-3 sm:p-4">
      <div className="grid h-full min-h-0 content-center gap-3" style={gridStyle}>
        {all.map((p) => (
          <div
            key={p.sid || p.identity}
            className="min-h-0 overflow-hidden rounded-2xl"
          >
            <VideoTile participant={p} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Choose a column count that yields visually pleasant tiles for `n` people.
 * Mirrors the buckets common in production conferencing UIs.
 */
function pickColumns(n: number): number {
  if (n <= 2) return 2;
  if (n <= 4) return 2;
  if (n <= 9) return 3;
  return 4;
}

function StagePlaceholder({ text, spinning = false }: { text: string; spinning?: boolean }) {
  return (
    <div className="grid h-full min-h-0 place-items-center p-6 text-center text-sm text-slate-300">
      <div>
        {spinning && (
          <div
            className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white"
            aria-hidden
          />
        )}
        {text}
      </div>
    </div>
  );
}
