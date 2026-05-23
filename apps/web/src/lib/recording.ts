/**
 * Tiny helpers for the local recorder. Pure functions; no React or DOM
 * mutation other than `URL.createObjectURL` for downloads.
 */

const PREFERRED_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4;codecs=h264,aac',
  'video/mp4',
];

/**
 * Returns the first MediaRecorder MIME type the browser actually supports.
 * Falls back to an empty string if none — caller should treat that as
 * "unsupported" rather than passing it to MediaRecorder.
 */
export function pickRecorderMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return '';
  }
  for (const mime of PREFERRED_MIME_TYPES) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      // ignore
    }
  }
  return '';
}

/** Best-guess file extension for the chosen MIME type. */
export function extForMime(mime: string): string {
  if (mime.startsWith('video/mp4')) return 'mp4';
  return 'webm';
}

/** YYYY-MM-DD-HH-mm-ss timestamp, safe for filenames. */
export function isoStampForFilename(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `-${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
  );
}

/** Triggers a download of the given Blob with the given file name. */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  // Some browsers require the anchor in the DOM to honor download.
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoking — Safari needs a tick to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 4_000);
}

/** Whether the browser exposes getDisplayMedia + MediaRecorder. */
export function isRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function' &&
    pickRecorderMimeType() !== ''
  );
}
