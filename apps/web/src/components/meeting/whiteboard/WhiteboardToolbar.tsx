'use client';
import {
  Circle,
  Eraser,
  Minus,
  Pencil,
  Redo,
  Square,
  Trash2,
  Type,
  Undo,
} from 'lucide-react';
import type { WhiteboardTool } from '@meetino/shared';
import { t } from '@/lib/i18n';

const COLORS = [
  '#0f172a', // slate-900 / default
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ffffff', // white (for chalkboard-like UI later)
];

const SIZES = [2, 4, 8, 14, 24];

interface Props {
  tool: WhiteboardTool;
  color: string;
  size: number;
  canUndo: boolean;
  canRedo: boolean;
  onToolChange: (tool: WhiteboardTool) => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

/**
 * Phase 7.7 — toolbar for the whiteboard.
 *
 * Layout:
 *   [pen] [eraser] [text] [line] [rect] [circle]   |   color swatches
 *   [size dots]                                    |   [undo] [redo] [clear]
 *
 * The toolbar lives ABOVE the canvas (above-and-attached on desktop,
 * pinned-top on mobile). Buttons are 36px so they're tappable.
 */
export function WhiteboardToolbar({
  tool,
  color,
  size,
  canUndo,
  canRedo,
  onToolChange,
  onColorChange,
  onSizeChange,
  onClear,
  onUndo,
  onRedo,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <ToolGroup>
        <ToolBtn active={tool === 'pen'} onClick={() => onToolChange('pen')} label={t.whiteboard.tools.pen}>
          <Pencil className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn active={tool === 'eraser'} onClick={() => onToolChange('eraser')} label={t.whiteboard.tools.eraser}>
          <Eraser className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn active={tool === 'text'} onClick={() => onToolChange('text')} label={t.whiteboard.tools.text}>
          <Type className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn active={tool === 'line'} onClick={() => onToolChange('line')} label={t.whiteboard.tools.line}>
          <Minus className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn active={tool === 'rect'} onClick={() => onToolChange('rect')} label={t.whiteboard.tools.rect}>
          <Square className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn active={tool === 'circle'} onClick={() => onToolChange('circle')} label={t.whiteboard.tools.circle}>
          <Circle className="h-4 w-4" />
        </ToolBtn>
      </ToolGroup>

      <span className="hidden h-6 w-px bg-slate-200 sm:block dark:bg-slate-700" aria-hidden />

      <div className="flex items-center gap-1" aria-label={t.whiteboard.colorLabel}>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onColorChange(c)}
            aria-label={c}
            className={[
              'h-6 w-6 rounded-full ring-2 transition',
              color === c
                ? 'ring-brand-500'
                : 'ring-transparent hover:ring-slate-300 dark:hover:ring-slate-600',
            ].join(' ')}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <span className="hidden h-6 w-px bg-slate-200 sm:block dark:bg-slate-700" aria-hidden />

      <div className="flex items-center gap-2" aria-label={t.whiteboard.sizeLabel}>
        {SIZES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSizeChange(s)}
            aria-label={String(s)}
            className={[
              'grid h-7 w-7 place-items-center rounded-full transition',
              size === s
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800',
            ].join(' ')}
          >
            <span
              className="block rounded-full bg-current"
              style={{ width: Math.max(3, s / 2), height: Math.max(3, s / 2) }}
            />
          </button>
        ))}
      </div>

      <div className="ms-auto flex items-center gap-1">
        <ToolBtn onClick={onUndo} disabled={!canUndo} label={t.whiteboard.actions.undo}>
          <Undo className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={onRedo} disabled={!canRedo} label={t.whiteboard.actions.redo}>
          <Redo className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          onClick={onClear}
          label={t.whiteboard.actions.clear}
          className="text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-900/30"
        >
          <Trash2 className="h-4 w-4" />
        </ToolBtn>
      </div>
    </div>
  );
}

function ToolGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1">{children}</div>;
}

function ToolBtn({
  children,
  active = false,
  disabled = false,
  label,
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={[
        'grid h-9 w-9 place-items-center rounded-lg transition',
        active
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
        disabled ? 'cursor-not-allowed opacity-50 hover:bg-transparent' : '',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}
