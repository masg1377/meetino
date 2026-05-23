import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { MeetingDto } from '@meetino/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { LivekitService } from '../../livekit/livekit.service';
import { MeetingGateway } from '../../realtime/meeting.gateway';
import { PresenceService } from '../../realtime/services/presence.service';
import { MeetingsService } from '../meetings.service';
import { HostAuthzService } from './host-authz.service';
import { CodeGeneratorService } from './code-generator.service';

/**
 * Phase 7 — host-only state transitions for a meeting.
 *
 * Every public method:
 *   1. Resolves the meeting by slug (rejects bad shape / not found).
 *   2. Confirms the caller (via {@link HostAuthzService}) is a host/admin.
 *   3. Mutates the DB row.
 *   4. Fires WS broadcasts and (where applicable) cleans up LiveKit.
 *
 * Errors are mapped to standard HTTP exceptions; callers in the controller
 * pass them straight through.
 */
@Injectable()
export class HostActionsService {
  private readonly logger = new Logger(HostActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly meetings: MeetingsService,
    private readonly authz: HostAuthzService,
    // LivekitService is in a forwardRef-cycle module — the @Inject is required.
    @Inject(forwardRef(() => LivekitService))
    private readonly livekit: LivekitService,
    private readonly gateway: MeetingGateway,
    private readonly presence: PresenceService,
    private readonly codeGen: CodeGeneratorService,
  ) {}

  // ── Lock / Unlock ────────────────────────────────────────────────

  async lock(slug: string, callerParticipantId: string): Promise<MeetingDto> {
    const meeting = await this.loadMeeting(slug);
    if (meeting.status === 'ENDED') {
      throw new BadRequestException('Meeting has already ended');
    }
    const caller = await this.authz.getParticipantInMeeting(meeting.id, callerParticipantId);
    await this.authz.assertCanHost(caller, meeting);

    if (meeting.isLocked) return this.meetings.toMeetingDto(meeting, meeting.host.displayName);

    const updated = await this.prisma.meeting.update({
      where: { id: meeting.id },
      data: { isLocked: true },
      include: { host: true },
    });

    const at = new Date().toISOString();
    this.gateway.broadcastLocked(updated.id, { at });
    this.logger.log(`Meeting ${slug} locked by ${caller.id}`);
    return this.meetings.toMeetingDto(updated, updated.host.displayName);
  }

  async unlock(slug: string, callerParticipantId: string): Promise<MeetingDto> {
    const meeting = await this.loadMeeting(slug);
    if (meeting.status === 'ENDED') {
      throw new BadRequestException('Meeting has already ended');
    }
    const caller = await this.authz.getParticipantInMeeting(meeting.id, callerParticipantId);
    await this.authz.assertCanHost(caller, meeting);

    if (!meeting.isLocked) return this.meetings.toMeetingDto(meeting, meeting.host.displayName);

    const updated = await this.prisma.meeting.update({
      where: { id: meeting.id },
      data: { isLocked: false },
      include: { host: true },
    });

    const at = new Date().toISOString();
    this.gateway.broadcastUnlocked(updated.id, { at });
    this.logger.log(`Meeting ${slug} unlocked by ${caller.id}`);
    return this.meetings.toMeetingDto(updated, updated.host.displayName);
  }

  // ── End meeting for everyone ─────────────────────────────────────

  async end(slug: string, callerParticipantId: string): Promise<MeetingDto> {
    const meeting = await this.loadMeeting(slug);
    if (meeting.status === 'ENDED') {
      // Idempotent — re-ending is a no-op, return the current state.
      return this.meetings.toMeetingDto(meeting, meeting.host.displayName);
    }
    const caller = await this.authz.getParticipantInMeeting(meeting.id, callerParticipantId);
    const { userId } = await this.authz.assertCanHost(caller, meeting);

    const now = new Date();

    // Phase 7.6 — finalize attendance for everyone still online before
    // the meeting clock stops. Each open session (lastJoinedAt != null)
    // gets credited up to `now`, then we set leftAt and zero the cursor.
    const stillOnline = await this.prisma.meetingParticipant.findMany({
      where: { meetingId: meeting.id, lastJoinedAt: { not: null } },
    });
    if (stillOnline.length > 0) {
      await this.prisma.$transaction(
        stillOnline.map((p) =>
          this.prisma.meetingParticipant.update({
            where: { id: p.id },
            data: {
              leftAt: p.leftAt ?? now,
              lastJoinedAt: null,
              totalDurationSeconds: {
                increment: p.lastJoinedAt
                  ? Math.max(
                      0,
                      Math.floor((now.getTime() - p.lastJoinedAt.getTime()) / 1000),
                    )
                  : 0,
              },
            },
          }),
        ),
      );
    }

    const durationSeconds = meeting.startedAt
      ? Math.max(0, Math.floor((now.getTime() - meeting.startedAt.getTime()) / 1000))
      : null;

    const updated = await this.prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        status: 'ENDED',
        endedAt: now,
        endedById: userId,
        durationSeconds,
        lastActivityAt: now,
      },
      include: { host: true },
    });

    // Best-effort cleanup of the SFU room. Non-fatal.
    await this.livekit.deleteRoom(meeting.slug);

    // Fan out + disconnect all WS sockets.
    await this.gateway.broadcastEnded(updated.id, {
      at: now.toISOString(),
      endedByParticipantId: caller.id,
    });

    this.logger.log(`Meeting ${slug} ended by ${caller.id}`);
    return this.meetings.toMeetingDto(updated, updated.host.displayName);
  }

  // ── Kick participant ─────────────────────────────────────────────

  async kick(
    slug: string,
    callerParticipantId: string,
    targetParticipantId: string,
  ): Promise<void> {
    const meeting = await this.loadMeeting(slug);
    if (meeting.status === 'ENDED') {
      throw new BadRequestException('Meeting has already ended');
    }
    const caller = await this.authz.getParticipantInMeeting(meeting.id, callerParticipantId);
    const { userId } = await this.authz.assertCanHost(caller, meeting);

    if (callerParticipantId === targetParticipantId) {
      throw new BadRequestException('You cannot kick yourself');
    }

    const target = await this.authz.getParticipantInMeeting(meeting.id, targetParticipantId);

    // Refuse to kick another host (would require an admin override path).
    if (target.role === 'HOST') {
      throw new ConflictException('Cannot kick another host');
    }

    if (target.wasKicked) {
      // Idempotent — already kicked, just re-broadcast.
      await this.gateway.broadcastKicked(meeting.id, {
        participantId: target.id,
        displayName: target.displayNameSnapshot,
        kickedByParticipantId: caller.id,
        at: (target.kickedAt ?? new Date()).toISOString(),
      });
      return;
    }

    const now = new Date();
    // Phase 7.6 — when kicking, also credit the in-progress session to
    // totalDurationSeconds so the attendance report reflects time actually
    // attended (kick acts like a forced leave).
    const sessionSeconds = target.lastJoinedAt
      ? Math.max(0, Math.floor((now.getTime() - target.lastJoinedAt.getTime()) / 1000))
      : 0;
    await this.prisma.meetingParticipant.update({
      where: { id: target.id },
      data: {
        wasKicked: true,
        kickedAt: now,
        kickedById: userId,
        leftAt: now,
        lastJoinedAt: null,
        totalDurationSeconds: { increment: sessionSeconds },
      },
    });

    // Drop them from presence + LiveKit room. Both are best-effort.
    await this.presence.forgetParticipant(meeting.slug, target.id);
    await this.livekit.removeParticipant(meeting.slug, target.id);

    // Broadcast + disconnect their sockets.
    await this.gateway.broadcastKicked(meeting.id, {
      participantId: target.id,
      displayName: target.displayNameSnapshot,
      kickedByParticipantId: caller.id,
      at: now.toISOString(),
    });

    this.logger.log(`Participant ${target.id} kicked from ${slug} by ${caller.id}`);
  }

  // ── Password set / clear ─────────────────────────────────────────

  async setPassword(
    slug: string,
    callerParticipantId: string,
    rawPassword: string,
  ): Promise<MeetingDto> {
    const meeting = await this.loadMeeting(slug);
    if (meeting.status === 'ENDED') {
      throw new BadRequestException('Meeting has already ended');
    }
    const caller = await this.authz.getParticipantInMeeting(meeting.id, callerParticipantId);
    await this.authz.assertCanHost(caller, meeting);

    const trimmed = rawPassword.trim();
    if (trimmed.length < 4 || trimmed.length > 64) {
      throw new BadRequestException('Password must be between 4 and 64 characters');
    }
    const hash = await argon2.hash(trimmed, { type: argon2.argon2id });

    const updated = await this.prisma.meeting.update({
      where: { id: meeting.id },
      data: { passwordHash: hash },
      include: { host: true },
    });
    this.logger.log(`Password set for ${slug} by ${caller.id}`);
    return this.meetings.toMeetingDto(updated, updated.host.displayName);
  }

  async clearPassword(slug: string, callerParticipantId: string): Promise<MeetingDto> {
    const meeting = await this.loadMeeting(slug);
    if (meeting.status === 'ENDED') {
      throw new BadRequestException('Meeting has already ended');
    }
    const caller = await this.authz.getParticipantInMeeting(meeting.id, callerParticipantId);
    await this.authz.assertCanHost(caller, meeting);

    const updated = await this.prisma.meeting.update({
      where: { id: meeting.id },
      data: { passwordHash: null },
      include: { host: true },
    });
    this.logger.log(`Password cleared for ${slug} by ${caller.id}`);
    return this.meetings.toMeetingDto(updated, updated.host.displayName);
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private async loadMeeting(slug: string) {
    if (!this.codeGen.isValidShape(slug)) {
      throw new NotFoundException('Meeting not found');
    }
    const meeting = await this.prisma.meeting.findUnique({
      where: { slug },
      include: { host: true },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }
}
