import {
  BadRequestException,
  Controller,
  ForbiddenException,
  forwardRef,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type { LivekitTokenResponse } from '@meetino/shared';
import { Public } from '../../common/decorators/public.decorator';
import { MeetingAuthService } from '../meetings/services/meeting-auth.service';
import { MeetingsService } from '../meetings/meetings.service';
import { LivekitService } from './livekit.service';

/**
 * POST /api/meetings/:slug/livekit-token
 *
 * Issues a short-lived LiveKit join token for the caller. Same auth rule
 * as /room and /chat: the caller must be a valid participant of THIS
 * meeting — registered via bearer OR guest via cookie. 401 otherwise.
 *
 * The endpoint is @Public() so the global JwtAuthGuard lets guests through;
 * MeetingAuthService does the real check.
 */
@Controller('meetings')
export class LivekitController {
  constructor(
    private readonly livekit: LivekitService,
    private readonly meetingAuth: MeetingAuthService,
    @Inject(forwardRef(() => MeetingsService))
    private readonly meetings: MeetingsService,
  ) {}

  @Public()
  @Post(':slug/livekit-token')
  @HttpCode(HttpStatus.OK)
  async getToken(
    @Param('slug') slug: string,
    @Req() req: Request,
  ): Promise<LivekitTokenResponse> {
    const participant = await this.meetingAuth.resolveParticipant(req, slug);

    // Phase 7 — refuse to mint a token for ended meetings or kicked users.
    if (participant.wasKicked) {
      throw new ForbiddenException('You were removed from this meeting');
    }
    const meeting = await this.meetings.findBySlugFull(slug);
    if (meeting.status === 'ENDED') {
      throw new BadRequestException('This meeting has ended');
    }

    return this.livekit.issueToken(participant, slug);
  }
}
