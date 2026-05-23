import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ChatMessage, MeetingParticipant } from '@prisma/client';
import { MAX_CHAT_BODY_LENGTH, type ChatMessageDto } from '@meetino/shared';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Chat persistence + read API.
 *
 * Identity rules:
 *   - We NEVER trust display name / role / type from the client. They come
 *     directly from the resolved MeetingParticipant row.
 *   - Body is validated again here (defense in depth) on top of the DTO,
 *     because the WS path could in principle bypass the DTO if a future
 *     refactor forgets to wire ValidationPipe.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  /** Default page size for GET /chat. Capped by MAX_HISTORY_LIMIT. */
  static readonly DEFAULT_HISTORY_LIMIT = 100;
  static readonly MAX_HISTORY_LIMIT = 200;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Save a message authored by `participant` in their meeting. Returns the
   * persisted row as a client-safe DTO. Throws on invalid bodies — callers
   * (gateway / controller) should map those to chat:error.
   */
  async saveMessage(
    participant: MeetingParticipant,
    rawBody: string,
  ): Promise<ChatMessageDto> {
    const body = this.normalizeBody(rawBody);

    const row = await this.prisma.chatMessage.create({
      data: {
        meetingId: participant.meetingId,
        participantId: participant.id,
        // Snapshot the sender's identity onto the row so the message survives
        // participant deletion intact (audit, history view, etc.).
        senderDisplayName: participant.displayNameSnapshot,
        senderRole: participant.role,
        senderType: participant.type,
        body,
      },
    });

    return this.toDto(row);
  }

  /**
   * List historical messages for a meeting, oldest-first (chronological).
   * Bounded by `limit` (defaults applied). For Phase 5 we don't paginate
   * past the last N messages — that's a Phase 6 nice-to-have.
   */
  async listForMeeting(
    meetingId: string,
    limit?: number,
  ): Promise<ChatMessageDto[]> {
    const take = this.normalizeLimit(limit);

    // Take the LAST `take` rows then flip back to ASC for the client.
    const rows = await this.prisma.chatMessage.findMany({
      where: { meetingId },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return rows.reverse().map((r) => this.toDto(r));
  }

  /**
   * Look up a meeting by slug — used by the HTTP controller before reading
   * history (so we never expose internal ids in URLs).
   */
  async findMeetingIdBySlug(slug: string): Promise<string> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting.id;
  }

  // ── Helpers ──────────────────────────────────────────────────────

  /** Trim → check non-empty → check max length. */
  normalizeBody(input: unknown): string {
    if (typeof input !== 'string') {
      throw new BadRequestException('Message body must be a string');
    }
    const body = input.trim();
    if (body.length === 0) {
      throw new BadRequestException('Message body cannot be empty');
    }
    if (body.length > MAX_CHAT_BODY_LENGTH) {
      throw new BadRequestException(
        `Message body cannot exceed ${MAX_CHAT_BODY_LENGTH} characters`,
      );
    }
    return body;
  }

  private normalizeLimit(limit?: number): number {
    if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) {
      return ChatService.DEFAULT_HISTORY_LIMIT;
    }
    return Math.min(Math.floor(limit), ChatService.MAX_HISTORY_LIMIT);
  }

  private toDto(row: ChatMessage): ChatMessageDto {
    return {
      id: row.id,
      meetingId: row.meetingId,
      participantId: row.participantId,
      senderDisplayName: row.senderDisplayName,
      senderRole: row.senderRole,
      senderType: row.senderType,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
