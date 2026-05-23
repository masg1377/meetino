import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import {
  MAX_FILE_SIZE_BYTES,
  type MeetingFileDeletedPayload,
  type MeetingFileDto,
  type MeetingFilesListResponse,
  type MeetingFileSharedPayload,
} from '@meetino/shared';
import { Public } from '../../common/decorators/public.decorator';
import type { AppConfig } from '../../config/configuration';
import { MeetingAuthService } from '../meetings/services/meeting-auth.service';
import { MeetingsService } from '../meetings/meetings.service';
import { MeetingGateway } from '../realtime/meeting.gateway';
import { UsersService } from '../users/users.service';
import { FilesService, type MulterFile } from './files.service';

/**
 * Phase 7.7 — meeting file sharing.
 *
 * All three routes are @Public() because guests must be able to use them
 * too (they're authenticated via the meetino_guest cookie, not the bearer).
 * MeetingAuthService.resolveParticipant() does the real auth check.
 *
 * Storage uses multer's memoryStorage so we control where the bytes land
 * (FilesService writes them under MEDIA_UPLOAD_DIR with a sanitized name).
 * Memory storage is fine because we cap fileSize per upload.
 */
@Controller('meetings')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly meetingAuth: MeetingAuthService,
    private readonly meetings: MeetingsService,
    private readonly gateway: MeetingGateway,
    private readonly users: UsersService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  // ── Upload ─────────────────────────────────────────────────────────

  @Public()
  @Post(':slug/files')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  async upload(
    @Param('slug') slug: string,
    @Req() req: Request,
    @UploadedFile() file: MulterFile,
  ): Promise<MeetingFileDto> {
    if (!file) throw new BadRequestException('No file was uploaded');

    const caller = await this.meetingAuth.resolveParticipant(req, slug);
    if (caller.wasKicked) {
      throw new BadRequestException('You were removed from this meeting');
    }
    const meeting = await this.meetings.findBySlugFull(slug);
    if (meeting.status === 'ENDED') {
      throw new BadRequestException('This meeting has already ended');
    }

    const dto = await this.files.upload(meeting.id, meeting.slug, caller, file);

    // Live-fan to peers so the FilesPanel updates immediately.
    const payload: MeetingFileSharedPayload = { file: dto };
    this.gateway.broadcastFileShared(meeting.id, payload);
    return dto;
  }

  // ── List ───────────────────────────────────────────────────────────

  @Public()
  @Get(':slug/files')
  async list(
    @Param('slug') slug: string,
    @Req() req: Request,
  ): Promise<MeetingFilesListResponse> {
    const caller = await this.meetingAuth.resolveParticipant(req, slug);
    if (caller.wasKicked) {
      throw new BadRequestException('You were removed from this meeting');
    }
    const meeting = await this.meetings.findBySlugFull(slug);
    const files = await this.files.list(meeting.id, meeting.slug);
    return { files };
  }

  // ── Download ───────────────────────────────────────────────────────

  // ── Delete ─────────────────────────────────────────────────────────

  /**
   * DELETE /api/meetings/:slug/files/:fileId
   *
   * Permissions:
   *   - The original uploader (matched by participantId on the row)
   *   - The meeting HOST (participant role HOST)
   *   - Any platform ADMIN
   *
   * On success we wipe the disk file + DB row, then broadcast
   * meeting:file-deleted so peers can drop it from their lists.
   */
  @Public()
  @Delete(':slug/files/:fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('slug') slug: string,
    @Param('fileId') fileId: string,
    @Req() req: Request,
  ): Promise<void> {
    const caller = await this.meetingAuth.resolveParticipant(req, slug);
    if (caller.wasKicked) {
      throw new BadRequestException('You were removed from this meeting');
    }
    const meeting = await this.meetings.findBySlugFull(slug);
    if (meeting.status === 'ENDED') {
      throw new BadRequestException('This meeting has already ended');
    }

    // ADMIN privilege only exists on the User row.
    let isPlatformAdmin = false;
    if (caller.userId) {
      const user = await this.users.findById(caller.userId);
      isPlatformAdmin = !!user && user.role === 'ADMIN';
    }

    const deleted = await this.files.delete(meeting.id, fileId, caller, isPlatformAdmin);

    const payload: MeetingFileDeletedPayload = {
      fileId: deleted.id,
      deletedByParticipantId: caller.id,
      at: new Date().toISOString(),
    };
    this.gateway.broadcastFileDeleted(meeting.id, payload);
  }

  /**
   * Streams the binary back. Image + PDF MIME types are served `inline`
   * (so the browser previews them); anything else (none today, but
   * future-safe) would be `attachment`. The original filename is
   * RFC 5987-encoded into Content-Disposition.
   */
  @Public()
  @Get(':slug/files/:fileId/download')
  async download(
    @Param('slug') slug: string,
    @Param('fileId') fileId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const caller = await this.meetingAuth.resolveParticipant(req, slug);
    if (caller.wasKicked) {
      throw new BadRequestException('You were removed from this meeting');
    }
    const meeting = await this.meetings.findBySlugFull(slug);

    const { row, absolutePath } = await this.files.resolveForDownload(meeting.id, fileId);
    if (!row) throw new NotFoundException('File not found');

    res.setHeader('Content-Type', row.mimeType);
    res.setHeader('Content-Length', row.sizeBytes.toString());
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(row.originalName)}`,
    );
    // No caching for shared files — they're rotated per meeting.
    res.setHeader('Cache-Control', 'no-store');

    const stream = this.files.openStream(absolutePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR);
      }
      res.end();
    });
    stream.pipe(res);
  }
}
