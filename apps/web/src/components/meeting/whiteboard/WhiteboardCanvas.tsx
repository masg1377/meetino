'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { WhiteboardOp, WhiteboardPoint, WhiteboardTool } from '@meetino/shared';

/**
 * Phase 7.7 — pure canvas renderer + input capture.
 *
 * Why hand-rolled instead of Konva/Fabric/tldraw?
 *   - The MVP needs ~6 tools, undo/redo, clear, and remote replay. Each of
 *     those libraries adds 60–500 KB to the bundle and a whole document
 *     model on top. We do all of it in ~200 lines.
 *   - Persian RTL/UI doesn't influence the canvas (it's a paint surface).
 *
 * Design:
 *   - We use a fixed *virtual* coordinate system (`VIRTUAL_W × VIRTUAL_H`)
 *     so peers on different screen sizes see the same drawing. Pointer
 *     events are mapped from canvas pixels to virtual coordinates before
 *     being emitted; rendering goes the other way.
 *   - Every render redraws the full ops list from scratch. This is O(n)
 *     per frame; fine up to a few thousand ops. The persisted snapshot
 *     is capped at 2000 ops server-side.
 *   - Touch is supported via Pointer Events.
 *
 * SSR: canvas access lives entirely inside effects.
 */

const VIRTUAL_W = 1920;
const VIRTUAL_H = 1080;

export interface WhiteboardCanvasProps {
  ops: WhiteboardOp[];
  tool: WhiteboardTool;
  color: string;
  size: number;
  /** Called when the user finishes a stroke / shape / text. */
  onCommitOp: (op: Omit<WhiteboardOp, 'authorId' | 'createdAt'>) => void;
  /** When true, all pointer input is ignored (e.g. while panel transitioning). */
  disabled?: boolean;
}

export function WhiteboardCanvas({
  ops,
  tool,
  color,
  size,
  onCommitOp,
  disabled = false,
}: WhiteboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // In-progress draft op (rendered on top of `ops`).
  const [draft, setDraft] = useState<WhiteboardOp | null>(null);
  const [textPrompt, setTextPrompt] = useState<{ x: number; y: number } | null>(null);
  const reactId = useId();

  // Resize observer keeps the canvas DPI-correct.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      redraw();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrapper);
    resize();
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw whenever ops/draft change.
  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ops, draft]);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Cheap background — pure white so the whiteboard reads as a board.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / VIRTUAL_W;
    const scaleY = canvas.height / VIRTUAL_H;

    const all = draft ? [...ops, draft] : ops;
    for (const op of all) drawOp(ctx, op, scaleX, scaleY);
  };

  // ── Input ─────────────────────────────────────────────────────────

  const isDrawing = useRef(false);
  const startPoint = useRef<WhiteboardPoint | null>(null);
  const currentPoints = useRef<WhiteboardPoint[]>([]);

  const toVirtual = (clientX: number, clientY: number): WhiteboardPoint => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return { x: 0, y: 0 };
    const rect = wrapper.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * VIRTUAL_W;
    const y = ((clientY - rect.top) / rect.height) * VIRTUAL_H;
    return { x: Math.max(0, Math.min(VIRTUAL_W, x)), y: Math.max(0, Math.min(VIRTUAL_H, y)) };
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (disabled) return;
    if (tool === 'text') {
      const p = toVirtual(e.clientX, e.clientY);
      setTextPrompt({ x: p.x, y: p.y });
      return;
    }
    isDrawing.current = true;
    (e.target as HTMLDivElement).setPointerCapture?.(e.pointerId);
    const p = toVirtual(e.clientX, e.clientY);
    startPoint.current = p;
    currentPoints.current = [p];
    setDraft(makeDraftOp(tool, color, size, currentPoints.current));
  };

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (disabled || !isDrawing.current) return;
    const p = toVirtual(e.clientX, e.clientY);
    if (tool === 'pen' || tool === 'eraser') {
      currentPoints.current = [...currentPoints.current, p];
    } else {
      // Shapes / line: keep start + end only.
      currentPoints.current = [startPoint.current!, p];
    }
    setDraft(makeDraftOp(tool, color, size, currentPoints.current));
  };

  const finishStroke = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const pts = currentPoints.current;
    currentPoints.current = [];
    startPoint.current = null;
    if (!draft || pts.length === 0) {
      setDraft(null);
      return;
    }
    onCommitOp({
      id: crypto.randomUUID(),
      tool: draft.tool,
      color: draft.color,
      size: draft.size,
      points: pts,
    });
    setDraft(null);
  };

  const submitText = (text: string) => {
    if (!textPrompt) return;
    const trimmed = text.trim().slice(0, 240);
    setTextPrompt(null);
    if (!trimmed) return;
    onCommitOp({
      id: crypto.randomUUID(),
      tool: 'text',
      color,
      size,
      points: [{ x: textPrompt.x, y: textPrompt.y }],
      text: trimmed,
    });
  };

  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full touch-none select-none bg-white"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishStroke}
      onPointerLeave={finishStroke}
    >
      <canvas ref={canvasRef} className="block h-full w-full" id={`wb-canvas-${reactId}`} />
      {textPrompt && (
        <TextEntry
          initialX={textPrompt.x}
          initialY={textPrompt.y}
          onCancel={() => setTextPrompt(null)}
          onSubmit={submitText}
          virtualW={VIRTUAL_W}
          virtualH={VIRTUAL_H}
          wrapperRef={wrapperRef}
        />
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function makeDraftOp(
  tool: WhiteboardTool,
  color: string,
  size: number,
  pts: WhiteboardPoint[],
): WhiteboardOp {
  return {
    id: '_draft',
    tool,
    color,
    size,
    points: pts,
    authorId: '_self',
    createdAt: new Date().toISOString(),
  };
}

function drawOp(
  ctx: CanvasRenderingContext2D,
  op: WhiteboardOp,
  scaleX: number,
  scaleY: number,
): void {
  if (op.points.length === 0 && op.tool !== 'text') return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, op.size * Math.min(scaleX, scaleY));

  if (op.tool === 'eraser') {
    // Eraser is just a thick white pen. (We don't do true compositing —
    // simpler and works fine for an additive board.)
    ctx.strokeStyle = '#ffffff';
  } else {
    ctx.strokeStyle = op.color;
    ctx.fillStyle = op.color;
  }

  switch (op.tool) {
    case 'pen':
    case 'eraser': {
      ctx.beginPath();
      const [first, ...rest] = op.points;
      ctx.moveTo(first.x * scaleX, first.y * scaleY);
      for (const p of rest) ctx.lineTo(p.x * scaleX, p.y * scaleY);
      ctx.stroke();
      break;
    }
    case 'line': {
      const [a, b] = op.points;
      if (!a || !b) break;
      ctx.beginPath();
      ctx.moveTo(a.x * scaleX, a.y * scaleY);
      ctx.lineTo(b.x * scaleX, b.y * scaleY);
      ctx.stroke();
      break;
    }
    case 'rect': {
      const [a, b] = op.points;
      if (!a || !b) break;
      const x = Math.min(a.x, b.x) * scaleX;
      const y = Math.min(a.y, b.y) * scaleY;
      const w = Math.abs(b.x - a.x) * scaleX;
      const h = Math.abs(b.y - a.y) * scaleY;
      ctx.strokeRect(x, y, w, h);
      break;
    }
    case 'circle': {
      const [a, b] = op.points;
      if (!a || !b) break;
      const cx = ((a.x + b.x) / 2) * scaleX;
      const cy = ((a.y + b.y) / 2) * scaleY;
      const rx = (Math.abs(b.x - a.x) / 2) * scaleX;
      const ry = (Math.abs(b.y - a.y) / 2) * scaleY;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'text': {
      if (!op.text || op.points.length === 0) break;
      const p = op.points[0];
      // Font size scales with `size` (8 - 64) but stays within a readable band.
      const fontPx = Math.max(14, Math.min(64, op.size * 4)) * Math.min(scaleX, scaleY);
      ctx.font = `${fontPx}px Vazirmatn, sans-serif`;
      ctx.fillStyle = op.color;
      ctx.textBaseline = 'top';
      // Persian text is right-aligned to feel natural; but we keep alignment
      // start-anchored so non-Persian users get familiar behavior.
      ctx.fillText(op.text, p.x * scaleX, p.y * scaleY);
      break;
    }
  }
  ctx.restore();
}

/**
 * Inline text-entry input that follows the click position. Keeps focus on
 * mount so the user can immediately start typing. Esc cancels, Enter commits.
 */
function TextEntry({
  initialX,
  initialY,
  onSubmit,
  onCancel,
  virtualW,
  virtualH,
  wrapperRef,
}: {
  initialX: number;
  initialY: number;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  virtualW: number;
  virtualH: number;
  wrapperRef: React.RefObject<HTMLDivElement>;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const rect = wrapperRef.current?.getBoundingClientRect();
  const left = rect ? (initialX / virtualW) * rect.width : 0;
  const top = rect ? (initialY / virtualH) * rect.height : 0;

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => (value.trim() ? onSubmit(value) : onCancel())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSubmit(value);
        else if (e.key === 'Escape') onCancel();
      }}
      maxLength={240}
      dir="auto"
      placeholder="متن…"
      className="absolute z-10 rounded border border-slate-300 bg-white/90 px-1.5 py-0.5 text-sm text-slate-900 shadow"
      style={{ left, top, minWidth: '8rem' }}
    />
  );
}
