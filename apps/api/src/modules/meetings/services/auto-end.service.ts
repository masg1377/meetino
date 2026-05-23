import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { LivekitService } from '../../livekit/livekit.service';
import { MeetingGateway } from '../../realtime/meeting.gateway';
import { PresenceService } from '../../realtime/services/presence.service';

/**
 * Phase 7.6 — automatically end "abandoned" meetings.
 *
 * Rules (must ALL hold for a meeting to be reaped):
 *   1. status === LIVE
 *   2. startedAt is older than {@link MIN_DURATION_MIN} minutes
 *   3. lastActivityAt is older than {@link IDLE_GRACE_MIN} minutes
 *      (this is the auto-end grace — protects against noisy reconnects)
 *   4. The Redis presence hash for the slug reports 0 online participants.
 *
 * On match we:
 *   - flip status to ENDED, stamp endedAt + durationSeconds
 *   - finalize any still-open attendance sessions (mirrors HostActionsService.end)
 *   - delete the LiveKit room (best-effort)
 *   - broadcast meeting:ended with endedByParticipantId=null
 *
 * The cron runs once per minute. We pick batches of 25 per tick so even a
 * pathological queue can't burn the loop.
 */
@Injectable()
export class AutoEndService {
  private readonly logger = new Logger(AutoEndService.name);

  /** Meetings shorter than this can never be reaped — protects fresh rooms. */
  private static readonly MIN_DURATION_MIN = 60;
  /** Grace window after lastActivityAt before we consider the room idle. */
  private static readonly IDLE_GRACE_MIN = 3;
  /** Max meetings to end per tick. */
  private static readonly BATCH = 25;

  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
    private readonly gateway: MeetingGateway,
    @Inject(forwardRef(() => LivekitService))
    private readonly livekit: LivekitService,
  ) {}

  /** Runs every minute. CronExpression.EVERY_MINUTE = '* * * * *'. */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'meetino:auto-end-empty' })
  async sweep(): Promise<void> {
    const now = Date.now();
    const startedBefore = new Date(now - AutoEndService.MIN_DURATION_MIN * 60_000);
    const idleBefore = new Date(now - AutoEndService.IDLE_GRACE_MIN * 60_000);

    // Coarse SQL filter — final emptiness check is done with Redis (presence).
    const candidates = await this.prisma.meeting.findMany({
      where: {
        status: 'LIVE',
        startedAt: { not: null, lt: startedBefore },
        OR: [
          { lastActivityAt: null },
          { lastActivityAt: { lt: idleBefore } },
        ],
      },
      select: {
        id: true,
        slug: true,
        startedAt: true,
        lastActivityAt: true,
      },
      take: AutoEndService.BATCH,
    });

    if (candidates.length === 0) return;

    for (const m of candidates) {
      try {
        const online = await this.presence.listParticipants(m.slug);
        if (online.some((p) => p.isOnline)) {
          // Someone is actually there — refresh activity and skip.
          await this.prisma.meeting
            .update({
              where: { id: m.id },
              data: { lastActivityAt: new Date() },
            })
            .catch(() => undefined);
          continue;
        }
        await this.endMeeting(m.id, m.slug, m.startedAt);
      } catch (err) {
        this.logger.warn(
          `Auto-end failed for ${m.slug}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async endMeeting(
    meetingId: string,
    slug: string,
    startedAt: Date | null,
  ): Promise<void> {
    const now = new Date();

    // Finalize any leftover attendance rows (e.g. process crash before leave).
    const stillOnline = await this.prisma.meetingParticipant.findMany({
      where: { meetingId, lastJoinedAt: { not: null } },
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

    const durationSeconds = startedAt
      ? Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000))
      : null;

    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: 'ENDED',
        endedAt: now,
        // endedById left null — system-ended, not a user action.
        durationSeconds,
        lastActivityAt: now,
        // Tag the auto-end in settings so we can show a different banner.
        settings: { autoEndedReason: 'EMPTY_TIMEOUT' },
      },
    });

    // LiveKit cleanup + broadcast. Both are best-effort.
    await this.livekit.deleteRoom(slug);
    await this.gateway.broadcastEnded(meetingId, {
      at: now.toISOString(),
      endedByParticipantId: null,
    });

    this.logger.log(`Auto-ended empty meeting ${slug} after idle timeout`);
  }
}
