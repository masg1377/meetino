'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { MeetingFileDto } from '@meetino/shared';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { t } from '@/lib/i18n';

/**
 * Phase 7.7 — file preview modal.
 *
 * The API requires bearer auth (or the guest cookie) on the download
 * route, so we cannot point an `<img>` / `<object>` directly at the API
 * URL — cross-origin requests from those elements don't carry the bearer
 * header. Instead we ask the parent (via `fetchBlob`) for an
 * authenticated Blob and render an in-page object URL.
 *
 * Object URLs live for the lifetime of the modal; we revoke them on
 * close/unmount to keep memory clean.
 */
export function FilePreviewModal({
  file,
  onClose,
  fetchBlob,
  download,
}: {
  file: MeetingFileDto | null;
  onClose: () => void;
  fetchBlob: (file: MeetingFileDto) => Promise<Blob>;
  download: (file: MeetingFileDto) => Promise<void>;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Esc / scroll lock.
  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [file, onClose]);

  // Fetch authenticated blob whenever the modal opens for a new file.
  useEffect(() => {
    if (!file) {
      setBlobUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    setLoading(true);
    setError(null);
    fetchBlob(file)
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message || 'بارگذاری پیش‌نمایش ناموفق بود.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [file, fetchBlob]);

  if (!file) return null;

  const isImage = file.mimeType.startsWith('image/');
  const isPdf = file.mimeType === 'application/pdf';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm md:items-center md:p-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl md:rounded-2xl dark:bg-slate-900">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
            {file.originalName}
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

        <div className="grow overflow-auto bg-slate-100 dark:bg-slate-950">
          {error && (
            <div className="p-4">
              <Alert variant="error">{error}</Alert>
            </div>
          )}
          {!error && loading && (
            <div className="grid place-items-center p-10 text-sm text-slate-500 dark:text-slate-400">
              {t.common.loading}…
            </div>
          )}
          {!error && !loading && blobUrl && isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={blobUrl}
              alt={file.originalName}
              className="mx-auto block max-h-[80vh] w-auto"
            />
          )}
          {!error && !loading && blobUrl && isPdf && (
            <object
              data={`${blobUrl}#view=FitH`}
              type="application/pdf"
              className="h-[80vh] w-full"
            >
              <div className="p-6 text-center text-sm text-slate-600 dark:text-slate-300">
                {t.files.pdfFallback}
                <div className="mt-3">
                  <a
                    href={blobUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-600 underline dark:text-brand-300"
                  >
                    {t.files.openInNewTab}
                  </a>
                </div>
              </div>
            </object>
          )}
          {!error && !loading && !isImage && !isPdf && (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {t.files.unsupportedPreview}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
          <Button variant="secondary" onClick={onClose}>
            {t.common.close}
          </Button>
          <Button variant="primary" onClick={() => void download(file)}>
            {t.files.download}
          </Button>
        </div>
      </div>
    </div>
  );
}
