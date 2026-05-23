import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type { ChatHistoryResponse } from '@meetino/shared';
import { Public } from '../../common/decorators/public.decorator';
import { MeetingAuthService } from '../meetings/services/meeting-auth.service';
import { ChatService } from './chat.service';

/**
 * GET /api/meetings/:slug/chat
 *
 * Returns the chronological history of chat messages for a meeting.
 * Same auth rule as /room: the caller must already be a participant
 * (registered via bearer OR guest via cookie). Anything else → 401.
 *
 * Marked @Public() so the global JwtAuthGuard lets guests through —
 * we do our own check via MeetingAuthService.
 */
@Controller('meetings')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly meetingAuth: MeetingAuthService,
  ) {}

  @Public()
  @Get(':slug/chat')
  async listHistory(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Query('limit', new DefaultValuePipe(0), ParseIntPipe) limit: number,
  ): Promise<ChatHistoryResponse> {
    // Throws 401 if neither bearer nor guest-cookie identifies a
    // participant in this meeting.
    await this.meetingAuth.resolveParticipant(req, slug);
    const meetingId = await this.chat.findMeetingIdBySlug(slug);
    const messages = await this.chat.listForMeeting(meetingId, limit || undefined);
    return { messages };
  }
}
