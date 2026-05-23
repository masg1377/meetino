'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import type { WhiteboardTool } from '@meetino/shared';
import { useWhiteboard } from '@/hooks/useWhiteboard';
import { t } from '@/lib/i18n';
import { WhiteboardCanvas } from './WhiteboardCanvas';
import { WhiteboardToolbar } from './WhiteboardToolbar';

/**
 * Phase 7.7 — main-stage whiteboard.
 *
 * The whiteboard renders as a centered overlay above the video grid when
 * open. We chose "main stage with overlay" over "side panel" because:
 *   - Drawing needs a large surface; squeezing into a 384px panel is bad.
 *   - The video grid is still visible behind a slight backdrop on hover-out;
 *     people who want to focus on faces can close the panel (toolbar button
 *     remains visible in the meeting toolbar).
 *
 * Mobile: the overlay takes the full screen minus the meeting toolbar.
 *
 * Realtime is handled in `useWhiteboard`; this component is only layout +
 * passing state through.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  socket: Socket | null;
  participantId: string | null;
}

export function WhiteboardPanel({ open, onClose, socket, participantId }: Props) {
  // Persist tool prefs across opens/closes — feels nicer than resetting.
  const [tool, setTool] = useState<WhiteboardTool>('pen');
  const [color, setColor] = useState<string>('#0f172a');
  const [size, setSize] = useState<number>(4);

  const wb = useWhiteboard({ socket, enabled: open, participantId });

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-slate-950/40 backdrop-blur-sm">
      <div className="m-2 flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:m-4">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t.whiteboard.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label={t.common.close}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <WhiteboardToolbar
          tool={tool}
          color={color}
          size={size}
          canUndo={wb.canUndo}
          canRedo={wb.canRedo}
          onToolChange={setTool}
          onColorChange={setColor}
          onSizeChange={setSize}
          onClear={wb.clearAll}
          onUndo={wb.undo}
          onRedo={wb.redo}
        />

        <div className="relative min-h-0 flex-1 overflow-hidden">
          {!wb.isReady && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-white/70 text-sm text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
              {t.whiteboard.loading}
            </div>
          )}
          <WhiteboardCanvas
            ops={wb.ops}
            tool={tool}
            color={color}
            size={size}
            onCommitOp={wb.applyLocalOp}
            disabled={!wb.isReady}
          />
        </div>
      </div>
    </div>
  );
}
