'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  MeetingClientEvent,
  MeetingServerEvent,
  type WhiteboardClearPayload,
  type WhiteboardOp,
  type WhiteboardOpPayload,
  type WhiteboardSnapshotPayload,
} from '@meetino/shared';

/**
 * Phase 7.7 — client-side whiteboard state + realtime sync.
 *
 * Source of truth: a local `ops` array. Each op is applied additively;
 * there is no per-op delete (a "clear" wipes the whole array).
 *
 * Wire protocol:
 *   - Local draws → emit `whiteboard:op` with the op payload.
 *   - Remote ops → received via `whiteboard:op`; appended locally.
 *   - Local clear → emit `whiteboard:clear`; we also clear our own state.
 *   - Remote clear → received via `whiteboard:clear`; clear locally.
 *   - On first JOIN we emit `whiteboard:snapshot-request`; the server
 *     replies with the persisted op array (late-joiner replay).
 *
 * Undo/redo:
 *   - We keep two stacks of *local* op ids. Undo removes the most recent
 *     local op from `ops`; redo restores it. We do NOT undo other people's
 *     work — that would be confusing in a shared board.
 *   - Undo/redo are LOCAL ONLY for the MVP. If we wanted them to be shared,
 *     we'd need a delete-by-id wire event; explicitly deferred.
 *
 * SSR-safety: the hook is `'use client'` and never touches `window` outside
 * of effects.
 */
export interface UseWhiteboard {
  ops: WhiteboardOp[];
  /** True until the initial snapshot has arrived (or we know there isn't one). */
  isReady: boolean;
  /** Apply a *local* op: store + broadcast + push to undo stack. */
  applyLocalOp: (op: Omit<WhiteboardOp, 'authorId' | 'createdAt'>) => void;
  /** Clear the board for everyone. */
  clearAll: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

interface Options {
  socket: Socket | null;
  /** True only while the panel is mounted so we don't pay snapshot costs forever. */
  enabled: boolean;
  /** Local participantId — used as authorId on every emitted op. */
  participantId: string | null;
}

export function useWhiteboard({ socket, enabled, participantId }: Options): UseWhiteboard {
  const [ops, setOps] = useState<WhiteboardOp[]>([]);
  const [isReady, setIsReady] = useState(false);

  // Undo / redo (local-only)
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<WhiteboardOp[]>([]);
  // Force re-render of canUndo/canRedo when the refs change.
  const [, bumpUi] = useState(0);
  const refreshUi = useCallback(() => bumpUi((n) => n + 1), []);

  // Track which ops are ours so undo can never wipe other authors' strokes.
  const myOpIds = useRef<Set<string>>(new Set());

  // ── Snapshot + realtime subscription ────────────────────────────
  useEffect(() => {
    if (!socket || !enabled) {
      setIsReady(false);
      return;
    }

    let cancelled = false;
    setIsReady(false);

    const onSnapshot = (payload: WhiteboardSnapshotPayload) => {
      if (cancelled) return;
      setOps(payload.ops ?? []);
      setIsReady(true);
    };
    const onOp = (payload: WhiteboardOpPayload) => {
      // Ignore echoes of our own ops (we already applied them optimistically).
      if (payload.op.authorId === participantId) return;
      setOps((prev) => (prev.some((x) => x.id === payload.op.id) ? prev : [...prev, payload.op]));
    };
    const onClear = (_p: WhiteboardClearPayload) => {
      setOps([]);
      undoStack.current = [];
      redoStack.current = [];
      myOpIds.current.clear();
      refreshUi();
    };

    socket.on(MeetingServerEvent.WHITEBOARD_SNAPSHOT, onSnapshot);
    socket.on(MeetingServerEvent.WHITEBOARD_OP, onOp);
    socket.on(MeetingServerEvent.WHITEBOARD_CLEAR, onClear);

    // Ask the server for the current state.
    if (socket.connected) {
      socket.emit(MeetingClientEvent.WHITEBOARD_SNAPSHOT_REQUEST);
    } else {
      // Re-request once the socket reconnects.
      const onConnect = () => socket.emit(MeetingClientEvent.WHITEBOARD_SNAPSHOT_REQUEST);
      socket.once('connect', onConnect);
      return () => {
        cancelled = true;
        socket.off('connect', onConnect);
        socket.off(MeetingServerEvent.WHITEBOARD_SNAPSHOT, onSnapshot);
        socket.off(MeetingServerEvent.WHITEBOARD_OP, onOp);
        socket.off(MeetingServerEvent.WHITEBOARD_CLEAR, onClear);
      };
    }

    return () => {
      cancelled = true;
      socket.off(MeetingServerEvent.WHITEBOARD_SNAPSHOT, onSnapshot);
      socket.off(MeetingServerEvent.WHITEBOARD_OP, onOp);
      socket.off(MeetingServerEvent.WHITEBOARD_CLEAR, onClear);
    };
  }, [socket, enabled, participantId, refreshUi]);

  // ── Local actions ───────────────────────────────────────────────

  const applyLocalOp = useCallback<UseWhiteboard['applyLocalOp']>(
    (partial) => {
      if (!socket || !participantId) return;
      const op: WhiteboardOp = {
        ...partial,
        authorId: participantId,
        createdAt: new Date().toISOString(),
      };
      setOps((prev) => [...prev, op]);
      myOpIds.current.add(op.id);
      undoStack.current.push(op.id);
      // Drawing a new op invalidates any redo state.
      redoStack.current = [];
      refreshUi();
      if (socket.connected) {
        socket.emit(MeetingClientEvent.WHITEBOARD_OP, { op } satisfies WhiteboardOpPayload);
      }
    },
    [socket, participantId, refreshUi],
  );

  const clearAll = useCallback(() => {
    if (!socket) return;
    setOps([]);
    undoStack.current = [];
    redoStack.current = [];
    myOpIds.current.clear();
    refreshUi();
    if (socket.connected) socket.emit(MeetingClientEvent.WHITEBOARD_CLEAR);
  }, [socket, refreshUi]);

  const undo = useCallback(() => {
    const lastId = undoStack.current.pop();
    if (!lastId) return;
    setOps((prev) => {
      const idx = prev.findIndex((o) => o.id === lastId);
      if (idx === -1) return prev;
      const removed = prev[idx];
      redoStack.current.push(removed);
      const copy = prev.slice();
      copy.splice(idx, 1);
      return copy;
    });
    refreshUi();
    // NB: undo is local-only — we don't tell peers about it. This is documented.
  }, [refreshUi]);

  const redo = useCallback(() => {
    const last = redoStack.current.pop();
    if (!last) return;
    setOps((prev) => [...prev, last]);
    undoStack.current.push(last.id);
    refreshUi();
  }, [refreshUi]);

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  return useMemo(
    () => ({ ops, isReady, applyLocalOp, clearAll, undo, redo, canUndo, canRedo }),
    [ops, isReady, applyLocalOp, clearAll, undo, redo, canUndo, canRedo],
  );
}
