import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import type {
  JoinMeetingResponse,
  MeetingDetailsDto,
  MeetingDto,
  MeetingHistoryItem,
  MeetingRoomDto,
  MeetingStatsDto,
  PublicMeetingDto,
} from '@meetino/shared';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import type { AppConfig } from '../../config/configuration';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { GuestJoinDto } from './dto/guest-join.dto';
import { RegisteredJoinDto } from './dto/registered-join.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { MeetingsService } from './meetings.service';
import { HostActionsService } from './services/host-actions.service';
import { MeetingAuthService, GUEST_COOKIE } from './services/meeting-auth.service';
import { MeetingReportsService } from './services/meeting-reports.service';
import { RejoinRequestsService } from './services/rejoin-requests.service';
import { CreateRejoinRequestDto } from './dto/create-rejoin-request.dto';
import type { RejoinRequestDto } from '@meetino/shared';
import type { GuestTokenPayload } from './types/guest-token';

const GUEST_TOKEN_TTL = '6h'; // long enough for a class, short enough to expire idle sessions

@Controller('meetings')
export class MeetingsController {
  constructor(
    private readonly meetings: MeetingsService,
    private readonly meetingAuth: MeetingAuthService,
    private readonly hostActions: HostActionsService,
    private readonly reports: MeetingReportsService,
    private readonly rejoin: RejoinRequestsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  // ── Protected (registered users only) ─────────────────────────────

  /** POST /api/meetings — create a meeting; caller becomes the host. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMeetingDto,
  ): Promise<MeetingDto> {
    return this.meetings.create(user.id, dto);
  }

  /** GET /api/meetings/my — list meetings I host. */
  @Get('my')
  async listMine(@CurrentUser() user: AuthUser): Promise<MeetingDto[]> {
    return this.meetings.findMyMeetings(user.id);
  }

  /** Phase 7.6 — GET /api/meetings/history — recent meetings (light shape). */
  @Get('history')
  async myHistory(@CurrentUser() user: AuthUser): Promise<MeetingHistoryItem[]> {
    return this.reports.getMyHistory(user.id, 50);
  }

  /** Phase 7.6 — GET /api/meetings/stats/me — dashboard analytics. */
  @Get('stats/me')
  async myStats(@CurrentUser() user: AuthUser): Promise<MeetingStatsDto> {
    return this.reports.getStatsForUser(user.id);
  }

  /**
   * Phase 7.6 — GET /api/meetings/:slug/details — meeting + attendance.
   * Host/admin gets the full list; regular participants get a redacted view
   * (their own row only). Non-participants 404.
   */
  @Get(':slug/details')
  async details(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
  ): Promise<MeetingDetailsDto> {
    return this.reports.getDetails(slug, user.id);
  }

  /** POST /api/meetings/:slug/join — registered user joins (idempotent). */
  @Post(':slug/join')
  @HttpCode(HttpStatus.OK)
  async joinAsRegistered(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Body() dto: RegisteredJoinDto,
  ): Promise<JoinMeetingResponse> {
    return this.meetings.joinAsRegistered(slug, user.id, { password: dto.password });
  }

  // ── Host-only controls (Phase 7) ───────────────────────────────────

  /**
   * All four host-control routes share the same auth flow:
   *   1. Resolve the caller's participant via bearer.
   *   2. HostActionsService verifies HOST/ADMIN inside.
   *   3. DB mutation + WS broadcast + (where applicable) LiveKit cleanup.
   */

  @Patch(':slug/lock')
  @HttpCode(HttpStatus.OK)
  async lockMeeting(
    @Param('slug') slug: string,
    @Req() req: Request,
  ): Promise<MeetingDto> {
    const caller = await this.meetingAuth.resolveParticipant(req, slug);
    return this.hostActions.lock(slug, caller.id);
  }

  @Patch(':slug/unlock')
  @HttpCode(HttpStatus.OK)
  async unlockMeeting(
    @Param('slug') slug: string,
    @Req() req: Request,
  ): Promise<MeetingDto> {
    const caller = await this.meetingAuth.resolveParticipant(req, slug);
    return this.hostActions.unlock(slug, caller.id);
  }

  @Post(':slug/end')
  @HttpCode(HttpStatus.OK)
  async endMeeting(
    @Param('slug') slug: string,
    @Req() req: Request,
  ): Promise<MeetingDto> {
    const caller = await this.meetingAuth.resolveParticipant(req, slug);
    return this.hostActions.end(slug, caller.id);
  }

  @Post(':slug/participants/:participantId/kick')
  @HttpCode(HttpStatus.NO_CONTENT)
  async kickParticipant(
    @Param('slug') slug: string,
    @Param('participantId') participantId: string,
    @Req() req: Request,
  ): Promise<void> {
    const caller = await this.meetingAuth.resolveParticipant(req, slug);
    await this.hostActions.kick(slug, caller.id, participantId);
  }

  @Post(':slug/password')
  @HttpCode(HttpStatus.OK)
  async setPassword(
    @Param('slug') slug: string,
    @Body() dto: SetPasswordDto,
    @Req() req: Request,
  ): Promise<MeetingDto> {
    const caller = await this.meetingAuth.resolveParticipant(req, slug);
    return this.hostActions.setPassword(slug, caller.id, dto.password);
  }

  @Delete(':slug/password')
  @HttpCode(HttpStatus.OK)
  async clearPassword(
    @Param('slug') slug: string,
    @Req() req: Request,
  ): Promise<MeetingDto> {
    const caller = await this.meetingAuth.resolveParticipant(req, slug);
    return this.hostActions.clearPassword(slug, caller.id);
  }

  // ── Phase 7.6 — rejoin approval ───────────────────────────────────

  /**
   * POST /api/meetings/:slug/rejoin-request
   *
   * @Public() because a kicked guest is still authenticated via the
   * meetino_guest cookie — MeetingAuthService resolves them. Registered
   * users are resolved by bearer.
   */
  @Public()
  @Post(':slug/rejoin-request')
  @HttpCode(HttpStatus.CREATED)
  async createRejoinRequest(
    @Param('slug') slug: string,
    @Body() dto: CreateRejoinRequestDto,
    @Req() req: Request,
  ): Promise<RejoinRequestDto> {
    const caller = await this.meetingAuth.resolveParticipant(req, slug);
    return this.rejoin.createRequest(slug, caller, dto.message);
  }

  /** POST /api/meetings/:slug/rejoin-requests/:requestId/approve — host only. */
  @Post(':slug/rejoin-requests/:requestId/approve')
  @HttpCode(HttpStatus.OK)
  async approveRejoinRequest(
    @Param('slug') slug: string,
    @Param('requestId') requestId: string,
    @Req() req: Request,
  ): Promise<RejoinRequestDto> {
    const caller = await this.meetingAuth.resolveParticipant(req, slug);
    return this.rejoin.approveRequest(slug, caller.id, requestId);
  }

  /** POST /api/meetings/:slug/rejoin-requests/:requestId/reject — host only. */
  @Post(':slug/rejoin-requests/:requestId/reject')
  @HttpCode(HttpStatus.OK)
  async rejectRejoinRequest(
    @Param('slug') slug: string,
    @Param('requestId') requestId: string,
    @Req() req: Request,
  ): Promise<RejoinRequestDto> {
    const caller = await this.meetingAuth.resolveParticipant(req, slug);
    return this.rejoin.rejectRequest(slug, caller.id, requestId);
  }

  // ── Public (pre-join + guest flow) ────────────────────────────────

  /** GET /api/meetings/public/:slug — minimal metadata for the pre-join page. */
  @Public()
  @Get('public/:slug')
  async findPublicBySlug(@Param('slug') slug: string): Promise<PublicMeetingDto> {
    return this.meetings.findBySlugPublic(slug);
  }

  /** POST /api/meetings/:slug/guest-join — guest joins by display name. */
  @Public()
  @Post(':slug/guest-join')
  @HttpCode(HttpStatus.OK)
  async joinAsGuest(
    @Param('slug') slug: string,
    @Body() dto: GuestJoinDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JoinMeetingResponse> {
    const { participant, meeting } = await this.meetings.joinAsGuest(
      slug,
      dto.displayName,
      { password: dto.password },
    );

    const guestPayload: GuestTokenPayload = {
      type: 'guest',
      sub: participant.id,
      room: meeting.slug,
      name: participant.displayNameSnapshot,
    };
    const jwtCfg = this.config.get('jwt', { infer: true });
    const token = await this.jwt.signAsync(guestPayload, {
      secret: jwtCfg.accessSecret,
      expiresIn: GUEST_TOKEN_TTL,
    });
    this.setGuestCookie(res, token);

    return {
      participant: this.meetings.toParticipantInfo(participant),
      meeting,
    };
  }

  /**
   * GET /api/meetings/:slug/room
   * Returns meeting + caller's participant identity. Works for both registered
   * users (bearer) and guests (cookie). 401 if neither path resolves.
   *
   * Phase 7.6 — kicked participants now receive the room shell with
   * wasKicked=true so the client can render the rejoin-request UI. The
   * LiveKit token endpoint still refuses to mint a join token, so they
   * physically can't enter media until a host approves their request.
   */
  @Public()
  @Get(':slug/room')
  async getRoom(@Param('slug') slug: string, @Req() req: Request): Promise<MeetingRoomDto> {
    const participant = await this.meetingAuth.resolveParticipant(req, slug);
    const meeting = await this.meetings.findBySlugFull(slug);

    if (participant.meetingId !== meeting.id) {
      // Belt-and-suspenders — shouldn't happen since resolveParticipant verifies.
      throw new BadRequestException('Participant does not belong to this meeting');
    }

    // Phase 7.6 — look up any pending rejoin request so the UI knows to
    // disable the "request rejoin" button after a submission.
    let pendingRejoinRequestId: string | null = null;
    if (participant.wasKicked) {
      const pending = await this.rejoin.findPendingRequestId(participant.id);
      pendingRejoinRequestId = pending;
    }

    return {
      meeting,
      participant: this.meetings.toParticipantInfo(participant),
      isHost: participant.role === 'HOST',
      wasKicked: participant.wasKicked,
      pendingRejoinRequestId,
    };
  }

  // ── Cookie helpers ────────────────────────────────────────────────

  private setGuestCookie(res: Response, token: string): void {
    const isProd = this.config.get('nodeEnv', { infer: true }) === 'production';
    res.cookie(GUEST_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 6 * 60 * 60 * 1000, // 6h, matches GUEST_TOKEN_TTL
    });
  }
}
