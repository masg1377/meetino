'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  MeetingServerEvent,
  type MeetingFileDeletedPayload,
  type MeetingFileDto,
  type MeetingFileSharedPayload,
  type MeetingFilesListResponse,
} from '@meetino/shared';
import { apiClient, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Phase 7.7 — file-sharing state for the meeting room.
 *
 * Lists are kept locally and reconciled via the realtime
 * `meeting:file-shared` event. We hydrate from `GET /files` on mount,
 * then prepend new files as they arrive over the socket.
 */
export interface UseMeetingFiles {
  files: MeetingFileDto[];
  isLoading: boolean;
  loadError: string | null;
  upload: (file: File) => Promise<MeetingFileDto>;
  /** Upload progress for the most recent submission, 0..1; null when idle. */
  uploadProgress: number | null;
  uploadError: string | null;
  clearUploadError: () => void;
  /** Force a re-fetch (e.g. on retry). */
  reload: () => Promise<void>;
  /**
   * Authenticated download — fetches the file binary through the API with
   * the bearer token / guest cookie attached, then resolves to a Blob.
   * The caller is responsible for the object-URL lifetime.
   */
  fetchBlob: (file: MeetingFileDto) => Promise<Blob>;
  /** Authenticated browser download (creates a temporary anchor + revokes URL). */
  download: (file: MeetingFileDto) => Promise<void>;
  /** Delete a shared file (uploader / host / admin). */
  deleteFile: (file: MeetingFileDto) => Promise<void>;
}

export function useMeetingFiles(
  slug: string | null,
  socket: Socket | null,
): UseMeetingFiles {
  const [files, setFiles] = useState<MeetingFileDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const reload = useCallback(async () => {
    if (!slug) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await apiClient.get<MeetingFilesListResponse>(`/meetings/${slug}/files`);
      setFiles(res.files);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'بارگذاری فایل‌ها با خطا مواجه شد.');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  // Initial fetch + socket subscription
  useEffect(() => {
    if (!slug) {
      setFiles([]);
      setIsLoading(false);
      return;
    }
    void reload();
  }, [slug, reload]);

  useEffect(() => {
    if (!socket) return;
    const onFileShared = (payload: MeetingFileSharedPayload) => {
      setFiles((prev) =>
        prev.some((f) => f.id === payload.file.id) ? prev : [...prev, payload.file],
      );
    };
    const onFileDeleted = (payload: MeetingFileDeletedPayload) => {
      setFiles((prev) => prev.filter((f) => f.id !== payload.fileId));
    };
    socket.on(MeetingServerEvent.FILE_SHARED, onFileShared);
    socket.on(MeetingServerEvent.FILE_DELETED, onFileDeleted);
    return () => {
      socket.off(MeetingServerEvent.FILE_SHARED, onFileShared);
      socket.off(MeetingServerEvent.FILE_DELETED, onFileDeleted);
    };
  }, [socket]);

  const upload = useCallback<UseMeetingFiles['upload']>(
    async (file) => {
      if (!slug) throw new Error('No slug');
      setUploadError(null);
      setUploadProgress(0);

      const form = new FormData();
      form.append('file', file);

      // We use XHR (not fetch) so we can observe upload progress. The
      // bearer token mirrors how api-client builds it; we don't run the
      // refresh-on-401 loop here because uploads are explicitly user-
      // initiated and rare.
      return new Promise<MeetingFileDto>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const url = `${getApiBase()}/meetings/${slug}/files`;
        xhr.open('POST', url, true);
        xhr.withCredentials = true;
        const token = readAccessToken();
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(e.loaded / e.total);
        };
        xhr.onerror = () => {
          setUploadError('ارسال فایل ناموفق بود. اتصال خود را بررسی کنید.');
          setUploadProgress(null);
          reject(new Error('network'));
        };
        xhr.onload = () => {
          setUploadProgress(null);
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const dto = JSON.parse(xhr.responseText) as MeetingFileDto;
              // Don't append here — the server's broadcast will do it for
              // both us and peers (avoids duplicate rows on slow networks).
              resolve(dto);
            } catch {
              setUploadError('پاسخ سرور نامعتبر بود.');
              reject(new Error('bad-response'));
            }
            return;
          }
          // Try to parse {statusCode, message} body.
          let message = 'ارسال فایل ناموفق بود.';
          try {
            const body = JSON.parse(xhr.responseText) as { message?: string };
            if (body?.message) message = body.message;
          } catch {
            // ignore
          }
          setUploadError(message);
          reject(new Error(message));
        };

        xhr.send(form);
      });
    },
    [slug],
  );

  const clearUploadError = useCallback(() => setUploadError(null), []);

  /**
   * Fetch a file's binary through the API with auth attached. Plain `<img>`
   * and `<a>` links can't carry the bearer token cross-origin, so any UI
   * that needs the bytes (preview or download) has to go through this.
   */
  const fetchBlob = useCallback<UseMeetingFiles['fetchBlob']>(async (file) => {
    const url = `${getApiBase()}${file.downloadPath.replace(/^\/api/, '')}`;
    const token = readAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers,
    });
    if (!res.ok) {
      // Try to surface the server's Persian message if available.
      let message = 'دانلود فایل ناموفق بود.';
      try {
        const body = (await res.json()) as { message?: string };
        if (body?.message) message = body.message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }
    return res.blob();
  }, []);

  const download = useCallback<UseMeetingFiles['download']>(
    async (file) => {
      const blob = await fetchBlob(file);
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = file.originalName;
        // Append + click + remove pattern is required for Firefox.
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        // Free immediately — the download has already started.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    },
    [fetchBlob],
  );

  const deleteFile = useCallback<UseMeetingFiles['deleteFile']>(
    async (file) => {
      if (!slug) return;
      await apiClient.delete<void>(`/meetings/${slug}/files/${file.id}`);
      // Optimistic — the WS echo will also remove it, but this keeps the
      // UI snappy if the broadcast lags.
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    },
    [slug],
  );

  return useMemo(
    () => ({
      files,
      isLoading,
      loadError,
      upload,
      uploadProgress,
      uploadError,
      clearUploadError,
      reload,
      fetchBlob,
      download,
      deleteFile,
    }),
    [
      files,
      isLoading,
      loadError,
      upload,
      uploadProgress,
      uploadError,
      clearUploadError,
      reload,
      fetchBlob,
      download,
      deleteFile,
    ],
  );
}

/** Pull the API base URL exactly the same way the rest of the app does. */
function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
}

/** Read the in-memory access token from the auth store at call time. */
function readAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return useAuthStore.getState().accessToken ?? null;
}
