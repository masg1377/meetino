import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AttendanceRecord,
  AttendanceStatus,
  MeetingDetailsDto,
  MeetingHistoryItem,
  MeetingStatsDto,
} from '@meetino/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { PresenceService } from '../../realtime/services/presence.service';
import { MeetingsService } from '../meetings.service';
import { CodeGeneratorService } from './code-generator.service';

/**
 * Phase 7.6 — read-side reporting for the dashboard.
 *
 * Responsibilities:
 *   - List meetings the caller has hosted, in reverse chronological order
 *     (history view).
 *   - Compose a meeting-detail snapshot (timings + attendance + chat count)
 *     with host/admin getting the full attendance list, regular participants
 *     getting a sanitized summary.
 *   - Aggregate per-user analytics: totals, averages, and recent items.
 *
 * IMPORTANT: every query is scoped to the caller (or asserts host/admin)
 * — we never trust client-side identity for sensitive reads.
 */
@Injectable()
export class MeetingReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly meetings: MeetingsService,
    private readonly presence: PresenceService,
    private readonly codeGen: CodeGeneratorService,
  ) {}

  // ── GET /meetings/history ─────────────────────────────────────────────

  async getMyHistory(userId: string, limit = 50): Promise<MeetingHistoryItem[]> {
    const rows = await this.prisma.meeting.findMany({
      where: { hostId: userId },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      include: {
        _count: { select: { participants: true } },
        participants: { select: { type: true } },
      },
    });

    return rows.map((m) => {
      const guestCount = m.participants.filter((p) => p.type === 'GUEST').length;
      const item: MeetingHistoryItem = {
        id: m.id,
        slug: m.slug,
        title: m.title,
        status: m.status,
        startedAt: m.startedAt?.toISOString() ?? null,
        endedAt: m.endedAt?.toISOString() ?? null,
        durationSeconds: this.persistedOrLiveDuration(m.status, m.startedAt, m.endedAt, m.durationSeconds),
        participantCount: m._count.participants,
        guestCount,
        createdAt: m.createdAt.toISOString(),
      };
      return item;
    });
  }

  // ── GET /meetings/:slug/details ────────────────────────────────────────

  async getDetails(
    slug: string,
    callerUserId: string,
  ): Promise<MeetingDetailsDto> {
    if (!this.codeGen.isValidShape(slug)) {
      throw new NotFoundException('Meeting not found');
    }
    const meeting = await this.prisma.meeting.findUnique({
      where: { slug },
      include: { host: true },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    const caller = await this.users.findById(callerUserId);
    if (!caller) throw new ForbiddenException('User no longer exists');

    const isHostView =
      caller.role === 'ADMIN' || meeting.hostId === callerUserId;

    // Non-host viewers must at least be a participant of this meeting
    // — otherwise they can't see attendance details at all (404 to avoid
    // leaking existence to random callers, even though slugs are short).
    if (!isHostView) {
      const p = await this.prisma.meetingParticipant.findFirst({
        where: { meetingId: meeting.id, userId: callerUserId },
      });
      if (!p) throw new NotFoundException('Meeting not found');
    }

    const [participants, chatMessageCount, livePresence] = await Promise.all([
      this.prisma.meetingParticipant.findMany({
        where: { meetingId: meeting.id },
        orderBy: [{ joinedAt: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.chatMessage.count({ where: { meetingId: meeting.id } }),
      meeting.status === 'LIVE'
        ? this.presence.listParticipants(meeting.slug).catch(() => [])
        : Promise.resolve([] as Awaited<ReturnType<PresenceService['listParticipants']>>),
    ]);

    const onlineIds = new Set(livePresence.map((p) => p.participantId));

    // Host view: every participant row.
    // Non-host view: only "this participant" — keep it private but still
    // informative so they can see their own join/leave times.
    const visible = isHostView
      ? participants
      : participants.filter((p) => p.userId === callerUserId);

    const attendance: AttendanceRecord[] = visible.map((p) => {
      const status: AttendanceStatus = p.wasKicked
        ? 'kicked'
        : onlineIds.has(p.id)
          ? 'active'
          : p.leftAt
            ? 'left'
            : meeting.status === 'LIVE'
              ? 'active' // joined but never marked offline yet
              : 'left';

      return {
        participantId: p.id,
        displayName: p.displayNameSnapshot,
        type: p.type,
        role: p.role,
        joinedAt: p.joinedAt?.toISOString() ?? null,
        leftAt: p.leftAt?.toISOString() ?? null,
        totalDurationSeconds: this.liveAccrualSeconds(p, onlineIds.has(p.id)),
        status,
        isOnline: onlineIds.has(p.id),
      };
    });

    return {
      meeting: this.meetings.toMeetingDto(meeting, meeting.host.displayName),
      attendance,
      chatMessageCount,
      isHostView,
    };
  }

  // ── GET /meetings/stats/me ────────────────────────────────────────────

  async getStatsForUser(userId: string): Promise<MeetingStatsDto> {
    const [all, recent] = await Promise.all([
      this.prisma.meeting.findMany({
        where: { hostId: userId },
        include: {
          _count: { select: { participants: true } },
          participants: { select: { type: true } },
        },
      }),
      this.getMyHistory(userId, 5),
    ]);

    const totalMeetings = all.length;
    const endedMeetings = all.filter((m) => m.status === 'ENDED').length;
    const activeMeetings = all.filter((m) => m.status === 'LIVE').length;

    let totalDurationSeconds = 0;
    for (const m of all) {
      const d = this.persistedOrLiveDuration(m.status, m.startedAt, m.endedAt, m.durationSeconds);
      if (d) totalDurationSeconds += d;
    }
    const denom = endedMeetings + activeMeetings;
    const averageDurationSeconds = denom > 0 ? Math.floor(totalDurationSeconds / denom) : 0;

    let totalParticipants = 0;
    let totalGuests = 0;
    for (const m of all) {
      totalParticipants += m._count.participants;
      totalGuests += m.participants.filter((p) => p.type === 'GUEST').length;
    }

    return {
      totalMeetings,
      endedMeetings,
      activeMeetings,
      totalDurationSeconds,
      averageDurationSeconds,
      totalParticipants,
      totalGuests,
      recentMeetings: recent,
    };
  }

  // ── Internals ────────────────────────────────────────────────────────

  /**
   * Picks the right duration value for a row:
   *   - ENDED + persisted durationSeconds → use it
   *   - ENDED with timestamps → compute from startedAt..endedAt
   *   - LIVE with startedAt → live (now - startedAt)
   *   - SCHEDULED/anything else → null
   */
  private persistedOrLiveDuration(
    status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED',
    startedAt: Date | null,
    endedAt: Date | null,
    persisted: number | null,
  ): number | null {
    if (status === 'ENDED') {
      if (typeof persisted === 'number') return persisted;
      if (startedAt && endedAt) {
        return Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
      }
      return null;
    }
    if (status === 'LIVE' && startedAt) {
      return Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
    }
    return null;
  }

  /**
   * For attendance "مدت حضور": uses the stored totalDurationSeconds, plus
   * the live session in progress (if any).
   */
  private liveAccrualSeconds(
    p: { totalDurationSeconds: number; lastJoinedAt: Date | null },
    isOnline: boolean,
  ): number {
    const base = p.totalDurationSeconds ?? 0;
    if (isOnline && p.lastJoinedAt) {
      return base + Math.max(0, Math.floor((Date.now() - p.lastJoinedAt.getTime()) / 1000));
    }
    return base;
  }
}
