'use client';
import { useRef, useState } from 'react';
import {
  Download,
  Eye,
  FileImage,
  FileText,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import type { MeetingFileDto } from '@meetino/shared';
import { useMeetingFiles } from '@/hooks/useMeetingFiles';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/meeting/ConfirmDialog';
import { t } from '@/lib/i18n';
import { formatDateTimeFa, toFa } from '@/lib/format';
import { FilePreviewModal } from './FilePreviewModal';
import type { Socket } from 'socket.io-client';

/**
 * Phase 7.7 — file-sharing side panel.
 *
 * Lives in the SidePanel slot alongside chat/participants. Top section is
 * the uploader (drag & drop + click); below it is the list of shared
 * files, newest at the bottom (to mirror chat ordering).
 */
export function FilesPanel({
  slug,
  socket,
  meParticipantId,
  isHost,
}: {
  slug: string;
  socket: Socket | null;
  /** Local caller's participantId — used to show the delete button on own files. */
  meParticipantId: string;
  /** True if the local caller is the meeting HOST or platform ADMIN. */
  isHost: boolean;
}) {
  const files = useMeetingFiles(slug, socket);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<MeetingFileDto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MeetingFileDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const canDelete = (f: MeetingFileDto) =>
    isHost || f.uploadedByParticipantId === meParticipantId;

  const onDownload = async (f: MeetingFileDto) => {
    setDownloadError(null);
    try {
      await files.download(f);
    } catch (err) {
      setDownloadError((err as Error).message);
    }
  };

  const onConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await files.deleteFile(confirmDelete);
      setConfirmDelete(null);
    } catch (err) {
      setDeleteError((err as Error).message || 'حذف فایل ناموفق بود.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    // We upload one file at a time so the progress bar tracks one transfer.
    for (const file of Array.from(list)) {
      try {
        await files.upload(file);
      } catch {
        // hook already surfaced the error
        break;
      }
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Uploader ───────────────────────────────────────── */}
      <div className="shrink-0 p-4">
        <label
          htmlFor="meetino-file-input"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFiles(e.dataTransfer.files);
          }}
          className={[
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition',
            dragging
              ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-900/30 dark:text-brand-200'
              : 'border-slate-300 bg-slate-50 text-slate-600 hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-800',
          ].join(' ')}
        >
          <UploadCloud className="h-6 w-6" />
          <span className="text-sm font-medium">{t.files.upload.cta}</span>
          <span className="text-xs opacity-75">{t.files.upload.hint}</span>
          <input
            id="meetino-file-input"
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files);
              // reset so re-selecting the same file fires onChange again
              if (inputRef.current) inputRef.current.value = '';
            }}
          />
        </label>

        {files.uploadProgress !== null && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full bg-brand-500 transition-all"
                style={{ width: `${Math.round(files.uploadProgress * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {toFa(Math.round(files.uploadProgress * 100))}%
            </p>
          </div>
        )}

        {files.uploadError && (
          <div className="mt-3">
            <Alert variant="error" onDismiss={files.clearUploadError}>
              {files.uploadError}
            </Alert>
          </div>
        )}
      </div>

      {/* ── List ───────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-200 px-4 py-3 dark:border-slate-800">
        <header className="mb-2 flex items-baseline justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t.files.listTitle}
          </h3>
          <span className="text-xs text-slate-400">{toFa(files.files.length)}</span>
        </header>

        {files.loadError && <Alert variant="error">{files.loadError}</Alert>}

        {!files.loadError && files.files.length === 0 && !files.isLoading && (
          <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {t.files.empty}
          </p>
        )}

        <ul className="space-y-2">
          {files.files.map((f) => (
            <li
              key={f.id}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                {f.mimeType === 'application/pdf' ? (
                  <FileText className="h-4 w-4" />
                ) : (
                  <FileImage className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                  {f.originalName}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                  {f.uploadedByDisplayName} ·{' '}
                  <span className="tabular-nums">{formatBytes(f.sizeBytes)}</span> ·{' '}
                  {formatDateTimeFa(f.createdAt)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setPreview(f)}>
                    <Eye className="h-3.5 w-3.5" />
                    {t.files.preview}
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => void onDownload(f)}>
                    <Download className="h-3.5 w-3.5" />
                    {t.files.download}
                  </Button>
                  {canDelete(f) && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(f)}
                      className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-900/30"
                      aria-label={t.files.delete}
                      title={t.files.delete}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t.files.delete}
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {downloadError && (
          <div className="mt-3">
            <Alert variant="error" onDismiss={() => setDownloadError(null)}>
              {downloadError}
            </Alert>
          </div>
        )}
      </div>

      <FilePreviewModal
        file={preview}
        onClose={() => setPreview(null)}
        fetchBlob={files.fetchBlob}
        download={files.download}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title={t.files.deleteConfirmTitle}
        message={
          confirmDelete
            ? t.files.deleteConfirmMessage(confirmDelete.originalName) +
              (deleteError ? `\n\n${deleteError}` : '')
            : ''
        }
        confirmLabel={t.files.delete}
        destructive
        busy={deleteBusy}
        onConfirm={onConfirmDelete}
        onCancel={() => {
          if (!deleteBusy) {
            setConfirmDelete(null);
            setDeleteError(null);
          }
        }}
      />
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${toFa(bytes)} بایت`;
  if (bytes < 1024 * 1024) return `${toFa((bytes / 1024).toFixed(1))} کیلوبایت`;
  return `${toFa((bytes / (1024 * 1024)).toFixed(1))} مگابایت`;
}
