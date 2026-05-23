import { promises as fs, createReadStream } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MeetingFile, MeetingParticipant } from '@prisma/client';
import {
  ALLOWED_FILE_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  type AllowedFileMimeType,
  type MeetingFileDto,
} from '@meetino/shared';
import type { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Phase 7.7 — meeting file sharing.
 *
 * Design choices:
 *   - Storage is self-hosted local disk under MEDIA_UPLOAD_DIR. The OS path
 *     is never returned to the client; downloads route through the API.
 *   - Filenames on disk are `<uuid>.<safe-ext>` so two users uploading
 *     `report.pdf` won't collide. The original name is preserved in DB.
 *   - MIME type is read from the upload (multer fills it in) and ALSO
 *     gated by an allow-list before write. Anything else 415s.
 *   - Size is checked twice: multer's `limits.fileSize` (cheap, early
 *     abort) and an in-handler sanity check just in case multer is
 *     misconfigured.
 *
 * Future hooks:
 *   - Antivirus scanning, image dimension limits — easy to slot in here.
 *   - S3/MinIO swap-out: replace fs.* with an interface.
 */
@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly uploadDir: string;
  private readonly maxFileSizeBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {
    const media = this.config.get('media', { infer: true });
    this.uploadDir = path.resolve(media.uploadDir);
    this.maxFileSizeBytes = Math.min(media.maxFileSizeBytes, MAX_FILE_SIZE_BYTES);
  }

  /** Lazily ensure the upload dir exists. Called by upload(). */
  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.uploadDir, { recursive: true });
  }

  // ── Upload ───────────────────────────────────────────────────────────

  /**
   * Persist a multer-style file to disk + DB row. Returns the public DTO.
   * Throws an HttpException for client-fixable problems.
   */
  async upload(
    meetingId: string,
    meetingSlug: string,
    uploader: MeetingParticipant,
    file: MulterFile,
  ): Promise<MeetingFileDto> {
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException('File is empty or missing');
    }
    if (file.size > this.maxFileSizeBytes) {
      throw new PayloadTooLargeException('File exceeds the allowed size');
    }
    if (!this.isAllowedMime(file.mimetype)) {
      throw new UnsupportedMediaTypeException(
        'This file type is not supported. Allowed: jpg, jpeg, png, webp, pdf.',
      );
    }

    await this.ensureDir();

    const ext = this.safeExtension(file.originalname, file.mimetype);
    const storedName = `${crypto.randomUUID()}${ext}`;
    const targetPath = path.join(this.uploadDir, storedName);

    try {
      await fs.writeFile(targetPath, file.buffer, { flag: 'wx' });
    } catch (err) {
      this.logger.error(
        `Failed to write upload to ${targetPath}: ${(err as Error).message}`,
      );
      throw new InternalServerErrorException('Could not store the uploaded file');
    }

    let row: MeetingFile;
    try {
      row = await this.prisma.meetingFile.create({
        data: {
          meetingId,
          uploadedByParticipantId: uploader.id,
          uploadedByDisplayName: uploader.displayNameSnapshot,
          originalName: this.safeOriginalName(file.originalname),
          storedName,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
      });
    } catch (err) {
      // DB row didn't land — drop the orphaned file.
      await fs.unlink(targetPath).catch(() => undefined);
      throw err;
    }

    this.logger.log(
      `File ${row.id} (${row.originalName}, ${row.sizeBytes}B) uploaded to ${meetingSlug} by ${uploader.id}`,
    );
    return this.toDto(row, meetingSlug);
  }

  // ── List ─────────────────────────────────────────────────────────────

  async list(meetingId: string, meetingSlug: string): Promise<MeetingFileDto[]> {
    const rows = await this.prisma.meetingFile.findMany({
      where: { meetingId },
      orderBy: [{ createdAt: 'asc' }],
    });
    return rows.map((r) => this.toDto(r, meetingSlug));
  }

  // ── Download ─────────────────────────────────────────────────────────

  /**
   * Resolve a file row for download. The caller (controller) streams the
   * actual bytes — service just hands back the file row + absolute path
   * for that stream.
   */
  async resolveForDownload(
    meetingId: string,
    fileId: string,
  ): Promise<{ row: MeetingFile; absolutePath: string }> {
    const row = await this.prisma.meetingFile.findUnique({ where: { id: fileId } });
    if (!row || row.meetingId !== meetingId) {
      throw new NotFoundException('File not found');
    }
    const absolutePath = path.join(this.uploadDir, row.storedName);
    // Guard against any path manipulation that snuck past safeExtension.
    const resolved = path.resolve(absolutePath);
    if (!resolved.startsWith(this.uploadDir)) {
      throw new NotFoundException('File not found');
    }
    return { row, absolutePath: resolved };
  }

  /** Read-stream helper for the controller. */
  openStream(absolutePath: string): NodeJS.ReadableStream {
    return createReadStream(absolutePath);
  }

  // ── Delete ───────────────────────────────────────────────────────────

  /**
   * Phase 7.7 — delete a shared file.
   *
   * Authorization rule:
   *   - The original uploader can always delete their own file (we match
   *     by participantId, not userId, so the rule survives for guests too).
   *   - A platform ADMIN can delete anything.
   *   - The meeting HOST can delete anything (we treat them as the room
   *     moderator). `caller.role === 'HOST'` is the participant-snapshot
   *     role which only registered hosts have.
   *
   * On success we remove the disk file (best-effort; missing files are
   * tolerated to keep the row removal idempotent) and the DB row.
   * Returns the deleted file id so the controller can broadcast it.
   */
  async delete(
    meetingId: string,
    fileId: string,
    caller: MeetingParticipant,
    callerIsPlatformAdmin: boolean,
  ): Promise<{ id: string; meetingId: string }> {
    const row = await this.prisma.meetingFile.findUnique({ where: { id: fileId } });
    if (!row || row.meetingId !== meetingId) {
      throw new NotFoundException('File not found');
    }

    const isUploader = row.uploadedByParticipantId === caller.id;
    const isHost = caller.role === 'HOST';
    if (!isUploader && !isHost && !callerIsPlatformAdmin) {
      throw new ForbiddenException('You cannot delete this file');
    }

    const absolutePath = path.join(this.uploadDir, row.storedName);
    const resolved = path.resolve(absolutePath);
    // Belt-and-suspenders: never delete outside our upload dir.
    if (resolved.startsWith(this.uploadDir)) {
      await fs.unlink(resolved).catch((err) => {
        // ENOENT is fine — the row is what matters.
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          this.logger.warn(
            `Failed to remove ${resolved} during delete: ${(err as Error).message}`,
          );
        }
      });
    }

    await this.prisma.meetingFile.delete({ where: { id: row.id } });
    this.logger.log(`File ${row.id} deleted from meeting ${meetingId} by ${caller.id}`);
    return { id: row.id, meetingId: row.meetingId };
  }

  // ── DTO / helpers ────────────────────────────────────────────────────

  toDto(row: MeetingFile, meetingSlug: string): MeetingFileDto {
    const downloadPath = `/api/meetings/${meetingSlug}/files/${row.id}/download`;
    return {
      id: row.id,
      meetingId: row.meetingId,
      originalName: row.originalName,
      mimeType: row.mimeType as AllowedFileMimeType,
      sizeBytes: row.sizeBytes,
      uploadedByDisplayName: row.uploadedByDisplayName,
      uploadedByParticipantId: row.uploadedByParticipantId,
      createdAt: row.createdAt.toISOString(),
      downloadPath,
      previewPath: downloadPath,
    };
  }

  private isAllowedMime(mime: string): mime is AllowedFileMimeType {
    return (ALLOWED_FILE_MIME_TYPES as readonly string[]).includes(mime);
  }

  /**
   * Pick a safe extension from the original filename, falling back to one
   * inferred from the MIME type. Always lowercase, always starts with `.`.
   */
  private safeExtension(original: string, mime: string): string {
    const m = /\.([a-zA-Z0-9]{1,8})$/.exec(original);
    const tail = m?.[1]?.toLowerCase() ?? '';
    const allowedByExt: Record<string, string> = {
      jpg: '.jpg',
      jpeg: '.jpg',
      png: '.png',
      webp: '.webp',
      pdf: '.pdf',
    };
    if (tail in allowedByExt) return allowedByExt[tail];

    // Fall back to MIME → extension.
    const mimeMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
    };
    return mimeMap[mime] ?? '.bin';
  }

  /**
   * Strip anything that's not letters/numbers/dot/dash/underscore/space
   * and cap at 200 chars. Avoids stuff like `../../../etc/passwd` showing
   * up in the displayed name even though we don't use it on disk.
   */
  private safeOriginalName(name: string): string {
    const trimmed = (name ?? '').trim().slice(0, 200);
    if (!trimmed) return 'file';
    return trimmed.replace(/[^\p{L}\p{N}._\- ]+/gu, '_');
  }
}

/** Minimal subset of Express.Multer.File so we don't drag the type everywhere. */
export interface MulterFile {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
}
