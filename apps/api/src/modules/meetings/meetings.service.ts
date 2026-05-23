import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { Meeting, MeetingParticipant } from '@prisma/client';
import {
  ParticipantRole,
  ParticipantType,
  MeetingStatus,
  type MeetingDto,
  type ParticipantInfo,
  type PublicMeetingDto,
} from '@meetino/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CodeGeneratorService } from './services/code-generator.service';
import type { CreateMeetingDto } from './dto/create-meeting.dto';

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly codeGen: CodeGeneratorService,
  ) {}

  // ── Creation ─────────────────────────────────────────────────────

  async create(hostId: string, dto: CreateMeetingDto): Promise<MeetingDto> {
    const slug = await this.generateUniqueSlug();
    const scheduledFor = dto.scheduledFor ? new Date(dto.scheduledFor) : null;
    const status: MeetingStatus = scheduledFor ? 'SCHEDULED' : 'LIVE';
    const now = new Date();

    const meeting = await this.prisma.meeting.create({
      data: {
        slug,
        title: dto.title,
        description: dto.description ?? null,
        hostId,
        status,
        scheduledFor,
        startedAt: status === 'LIVE' ? now : null,
      },
      include: { host: true },
    });

    this.logger.log(`Meeting created: ${slug} (host=${hostId})`);
    return this.toMeetingDto(meeting, meeting.host.displayName);
  }

  // ── Reads ────────────────────────────────────────────────────────

  async findMyMeetings(userId: string): Promise<MeetingDto[]> {
    const rows = await this.prisma.meeting.findMany({
      where: { hostId: userId },
      orderBy: [{ createdAt: 'desc' }],
      include: { host: true },
    });
    return rows.map((m) => this.toMeetingDto(m, m.host.displayName));
  }

  async findBySlugPublic(slug: string): Promise<PublicMeetingDto> {
    const meeting = await this.assertExistsBySlug(slug);
    if (meeting.status === 'CANCELLED') {
      throw new NotFoundException('Meeting not found');
    }
    return {
      slug: meeting.slug,
      title: meeting.title,
      status: meeting.status,
      hostDisplayName: meeting.host.displayName,
      scheduledFor: meeting.scheduledFor?.toISOString() ?? null,
      isLocked: meeting.isLocked,
      hasPassword: !!meeting.passwordHash,
    };
  }

  async findBySlugFull(slug: string): Promise<MeetingDto> {
    const meeting = await this.assertExistsBySlug(slug);
    return this.toMeetingDto(meeting, meeting.host.displayName);
  }

  // ── Joining ──────────────────────────────────────────────────────

  /**
   * Idempotent join for a registered user. If they're the host, role=HOST.
   * Otherwise role=STUDENT. Re-joining returns the existing participant.
   *
   * Phase 7 gates (in order):
   *   - ENDED meetings reject everyone.
   *   - LOCKED meetings reject anyone who isn't the owning host, a platform
   *     ADMIN, or someone who was already a participant before the lock.
   *   - If a password is set, the caller MUST supply it on first join.
   *     Already-joined users skip the password check (they're trusted).
   *   - Kicked participants cannot rejoin (HTTP 403).
   */
  async joinAsRegistered(
    slug: string,
    userId: string,
    opts: { password?: string } = {},
  ): Promise<{
    participant: ParticipantInfo;
    meeting: { id: string; slug: string; title: string };
  }> {
    const meeting = await this.assertJoinable(slug);

    const user = await this.users.findById(userId);
    if (!user) throw new ForbiddenException('User no longer exists');

    const existing = await this.prisma.meetingParticipant.findFirst({
      where: { meetingId: meeting.id, userId },
    });

    if (existing?.wasKicked) {
      throw new ForbiddenException('You were removed from this meeting');
    }

    const isHost = meeting.hostId === userId;
    const isAdmin = user.role === 'ADMIN';

    // Lock gate — the host, admins, and already-joined users get through.
    if (meeting.isLocked && !isHost && !isAdmin && !existing) {
      throw new ConflictException('This meeting is locked');
    }

    // Password gate — first-time joiners only.
    if (meeting.passwordHash && !existing && !isHost && !isAdmin) {
      await this.verifyMeetingPassword(meeting.passwordHash, opts.password);
    }

    const role: ParticipantRole = isHost ? 'HOST' : 'STUDENT';

    const now = new Date();
    const participant = existing
      ? await this.prisma.meetingParticipant.update({
          where: { id: existing.id },
          data: {
            leftAt: null,
            joinedAt: existing.joinedAt ?? now,
            // Phase 7.6 — stamp a fresh session-start so leave can compute
            // this session's duration without overwriting joinedAt.
            lastJoinedAt: now,
            displayNameSnapshot: user.displayName,
            role, // refresh in case the host re-joins
          },
        })
      : await this.prisma.meetingParticipant.create({
          data: {
            meetingId: meeting.id,
            userId,
            type: 'REGISTERED',
            role,
            displayNameSnapshot: user.displayName,
            joinedAt: now,
            lastJoinedAt: now,
          },
        });

    // If this is the first join and meeting was SCHEDULED, flip it LIVE.
    if (meeting.status === 'SCHEDULED' && isHost) {
      await this.prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          status: 'LIVE',
          startedAt: meeting.startedAt ?? now,
          lastActivityAt: now,
        },
      });
    } else {
      // Phase 7.6 — touch lastActivityAt so the auto-end job doesn't reap us.
      await this.prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          lastActivityAt: now,
          // Also opportunistically set startedAt for legacy LIVE rows that
          // somehow never got one (shouldn't happen, but cheap insurance).
          startedAt: meeting.startedAt ?? (meeting.status === 'LIVE' ? now : meeting.startedAt),
        },
      });
    }

    return {
      participant: this.toParticipantInfo(participant),
      meeting: { id: meeting.id, slug: meeting.slug, title: meeting.title },
    };
  }

  /**
   * Creates a guest participant. Always creates a new row (no dedup by name).
   * The caller (controller) issues the guest JWT and sets the cookie.
   *
   * Phase 7 gates: ENDED → 400, LOCKED → 409, passwordHash set → 401 unless
   * a matching password is supplied. Guests are NEVER exempt from any of
   * these (no admin overrides on the guest path).
   */
  async joinAsGuest(
    slug: string,
    displayName: string,
    opts: { password?: string } = {},
  ): Promise<{
    participant: MeetingParticipant;
    meeting: { id: string; slug: string; title: string };
  }> {
    const meeting = await this.assertJoinable(slug);

    if (meeting.isLocked) {
      throw new ConflictException('This meeting is locked');
    }
    if (meeting.passwordHash) {
      await this.verifyMeetingPassword(meeting.passwordHash, opts.password);
    }

    const now = new Date();
    const participant = await this.prisma.meetingParticipant.create({
      data: {
        meetingId: meeting.id,
        userId: null,
        guestName: displayName,
        type: 'GUEST',
        role: 'GUEST',
        displayNameSnapshot: displayName,
        joinedAt: now,
        lastJoinedAt: now,
      },
    });

    // Phase 7.6 — guests also count as activity for auto-end gating, and
    // also nudge the meeting to LIVE on first ever entry.
    await this.prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        lastActivityAt: now,
        startedAt: meeting.startedAt ?? now,
        status: meeting.status === 'SCHEDULED' ? 'LIVE' : meeting.status,
      },
    });

    return {
      participant,
      meeting: { id: meeting.id, slug: meeting.slug, title: meeting.title },
    };
  }

  // ── Phase 7.6 helpers used by gateway / cleanup ──────────────────────

  /**
   * Stamp the meeting's lastActivityAt to now. Called from the realtime
   * gateway on every join/leave so the auto-end job has fresh data.
   * Best-effort (we swallow errors so a transient DB hiccup never breaks
   * a join broadcast).
   */
  async touchActivity(meetingId: string): Promise<void> {
    try {
      await this.prisma.meeting.update({
        where: { id: meetingId },
        data: { lastActivityAt: new Date() },
      });
    } catch {
      // ignore
    }
  }

  /**
   * Called when a participant disconnects ("left").
   *
   *   - Stamps leftAt to the disconnect moment.
   *   - Accumulates `totalDurationSeconds` for the most-recent online session
   *     (now - lastJoinedAt). If there's no lastJoinedAt (very old rows or
   *     a guest who never properly joined) we credit zero rather than guess.
   *   - Clears lastJoinedAt so a reconnect starts a fresh session.
   */
  async recordParticipantLeft(participantId: string): Promise<void> {
    const p = await this.prisma.meetingParticipant.findUnique({
      where: { id: participantId },
    });
    if (!p) return;
    const now = new Date();
    const sessionSeconds = p.lastJoinedAt
      ? Math.max(0, Math.floor((now.getTime() - p.lastJoinedAt.getTime()) / 1000))
      : 0;
    await this.prisma.meetingParticipant.update({
      where: { id: participantId },
      data: {
        leftAt: now,
        lastJoinedAt: null,
        totalDurationSeconds: { increment: sessionSeconds },
      },
    });
    // Also touch the meeting clock for auto-end heuristics.
    await this.prisma.meeting
      .update({
        where: { id: p.meetingId },
        data: { lastActivityAt: now },
      })
      .catch(() => undefined);
  }

  // ── Mappers ──────────────────────────────────────────────────────

  toParticipantInfo(p: MeetingParticipant): ParticipantInfo {
    return {
      id: p.id,
      displayName: p.displayNameSnapshot,
      role: p.role,
      type: p.type,
      userId: p.userId,
    };
  }

  toMeetingDto(meeting: Meeting, hostDisplayName: string): MeetingDto {
    return {
      id: meeting.id,
      slug: meeting.slug,
      title: meeting.title,
      description: meeting.description,
      hostId: meeting.hostId,
      hostDisplayName,
      status: meeting.status,
      scheduledFor: meeting.scheduledFor?.toISOString() ?? null,
      startedAt: meeting.startedAt?.toISOString() ?? null,
      endedAt: meeting.endedAt?.toISOString() ?? null,
      endedById: meeting.endedById,
      isLocked: meeting.isLocked,
      hasPassword: !!meeting.passwordHash,
      // Phase 7.6 — live duration for LIVE, persisted duration for ENDED.
      durationSeconds: this.computeDurationSeconds(meeting),
      // Phase 7.6 — surface the auto-end marker for the client banner.
      autoEndedReason: this.readAutoEndedReason(meeting.settings),
      createdAt: meeting.createdAt.toISOString(),
      updatedAt: meeting.updatedAt.toISOString(),
    };
  }

  /**
   * Reads `settings.autoEndedReason` defensively (settings is `Json`, so we
   * can't assume shape). Returns null for anything that isn't the literal
   * 'EMPTY_TIMEOUT' string written by AutoEndService.
   */
  private readAutoEndedReason(settings: unknown): 'EMPTY_TIMEOUT' | null {
    if (settings && typeof settings === 'object' && 'autoEndedReason' in settings) {
      const v = (settings as Record<string, unknown>).autoEndedReason;
      if (v === 'EMPTY_TIMEOUT') return v;
    }
    return null;
  }

  /**
   * Phase 7.6 — duration calculation rule:
   *   - ENDED: prefer the stored durationSeconds. If missing (legacy rows),
   *     compute from startedAt..endedAt and round to whole seconds.
   *   - LIVE:  startedAt → now.
   *   - SCHEDULED/CANCELLED: null.
   */
  private computeDurationSeconds(meeting: Meeting): number | null {
    if (meeting.status === 'ENDED') {
      if (typeof meeting.durationSeconds === 'number') return meeting.durationSeconds;
      if (meeting.startedAt && meeting.endedAt) {
        return Math.max(
          0,
          Math.floor((meeting.endedAt.getTime() - meeting.startedAt.getTime()) / 1000),
        );
      }
      return null;
    }
    if (meeting.status === 'LIVE' && meeting.startedAt) {
      return Math.max(
        0,
        Math.floor((Date.now() - meeting.startedAt.getTime()) / 1000),
      );
    }
    return null;
  }

  // ── Helpers ──────────────────────────────────────────────────────

  /**
   * Compare a raw password against the meeting's stored hash. Always runs
   * an argon2 verify (even on empty input) so an attacker can't time-probe
   * "is this meeting password-protected".
   */
  private async verifyMeetingPassword(
    storedHash: string,
    raw: string | undefined,
  ): Promise<void> {
    const candidate = (raw ?? '').trim();
    const ok = candidate.length > 0
      ? await argon2.verify(storedHash, candidate)
      : false;
    if (!ok) {
      throw new UnauthorizedException('A valid password is required for this meeting');
    }
  }

  private async generateUniqueSlug(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = this.codeGen.generate();
      const exists = await this.prisma.meeting.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!exists) return slug;
    }
    throw new InternalServerErrorException('Could not generate a unique meeting slug');
  }

  private async assertExistsBySlug(slug: string) {
    if (!this.codeGen.isValidShape(slug)) throw new NotFoundException('Meeting not found');
    const meeting = await this.prisma.meeting.findUnique({
      where: { slug },
      include: { host: true },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }

  /** Like assertExistsBySlug but also rejects ENDED/CANCELLED status for joining. */
  private async assertJoinable(slug: string) {
    const meeting = await this.assertExistsBySlug(slug);
    if (meeting.status === 'ENDED') {
      throw new BadRequestException('This meeting has already ended');
    }
    if (meeting.status === 'CANCELLED') {
      throw new BadRequestException('This meeting was cancelled');
    }
    return meeting;
  }
}
