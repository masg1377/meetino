/**
 * Phase 7.7 — file sharing inside a meeting.
 *
 * Files live on the API server's filesystem (MEDIA_UPLOAD_DIR). Clients
 * never see the absolute path — they get a `MeetingFileDto` with a
 * short download URL that the API authorizes per request.
 */

export const ALLOWED_FILE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;
export type AllowedFileMimeType = (typeof ALLOWED_FILE_MIME_TYPES)[number];

/** 25 MB — generous enough for class PDFs, small enough to keep abuse contained. */
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export interface MeetingFileDto {
  id: string;
  meetingId: string;
  originalName: string;
  mimeType: AllowedFileMimeType;
  sizeBytes: number;
  uploadedByDisplayName: string;
  uploadedByParticipantId: string | null;
  createdAt: string;
  /**
   * Path appended to the API base URL to fetch the binary, e.g.
   * `/api/meetings/<slug>/files/<id>/download`. Always relative.
   */
  downloadPath: string;
  /**
   * For images, the same as downloadPath — clients can use it as an <img src>.
   * For PDFs, also points at download (with content-disposition inline).
   */
  previewPath: string;
}

/** GET /api/meetings/:slug/files response. */
export interface MeetingFilesListResponse {
  files: MeetingFileDto[];
}

/** Realtime — broadcast when a file is shared. */
export interface MeetingFileSharedPayload {
  file: MeetingFileDto;
}

/** Realtime — broadcast when a file is removed by uploader / host / admin. */
export interface MeetingFileDeletedPayload {
  fileId: string;
  /** participantId of the actor; null for system actions. */
  deletedByParticipantId: string | null;
  at: string;
}
