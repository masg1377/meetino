'use client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  /** Defaults to "تأیید". */
  confirmLabel?: string;
  /** Defaults to "انصراف". */
  cancelLabel?: string;
  /** Mark the confirm button as destructive (red). */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Persian-friendly confirmation dialog used by Phase 7 host actions
 * (end meeting, kick participant). Wraps the existing UI Modal.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'تأیید',
  cancelLabel = 'انصراف',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            onClick={() => void onConfirm()}
            disabled={busy}
            className={destructive ? 'bg-rose-600 hover:bg-rose-700' : undefined}
          >
            {busy ? 'در حال انجام…' : confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{message}</p>
    </Modal>
  );
}
