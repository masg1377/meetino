import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { MeetingParticipant } from '@prisma/client';
import type { RejoinRequestDto } from '@meetino/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { MeetingGateway } from '../../realtime/meeting.gateway';
import { HostAuthzService } from './host-authz.service';
import { CodeGeneratorService } from './code-generator.service';

/**
 * Phase 7.6 — workflow for kicked participants asking to rejoin.
 *
 * Lifecycle:
 *   PENDING ──(host approve)──> APPROVED  → wasKicked cleared, can rejoin
 *           ──(host reject)──> REJECTED  → still kicked
 *
 * Guardrails:
 *   - Only a kicked participant can create a request — non-kicked callers
 *     get 409 (they don't need permission to rejoin).
 *   - Only one PENDING request per participant: a second `create` is
 *     coalesced into the existing pending row (we just update its message).
 *   - Only host/admin can approve or reject. Both ops are idempotent on a
 *     non-pending row (no error if you re-resolve, no broadcast either).
 *   - The participant's identity is taken from MeetingAuthService at the
 *     controller boundary — this service never trusts user-supplied IDs.
 */
@Injectable()
export class RejoinRequestsService {
  private readonly logger = new Logger(RejoinRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: HostAuthzService,
    private readonly gateway: MeetingGateway,
    private readonly codeGen: CodeGeneratorService,
  ) {}

  // ── Participant: create a request ────────────────────────────────────

  async createRequest(
    slug: string,
    caller: MeetingParticipant,
    message: string | undefined,
  ): Promise<RejoinRequestDto> {
    const meeting = await this.loadMeeting(slug);
    if (meeting.id !== caller.meetingId) {
      throw new ForbiddenException('You must join this meeting first');
    }
    if (meeting.status === 'ENDED') {
      throw new BadRequestException('This meeting has already ended');
    }
    if (!caller.wasKicked) {
      // Non-kicked users do not go through this flow.
      throw new ConflictException(
        'You are not blocked from this meeting and do not need approval',
      );
    }

    const trimmed = message?.trim() || null;

    // Coalesce with any existing PENDING row.
    const existing = await this.prisma.rejoinRequest.findFirst({
      where: { participantId: caller.id, status: 'PENDING' },
    });
    const row = existing
      ? await this.prisma.rejoinRequest.update({
          where: { id: existing.id },
          data: { message: trimmed },
        })
      : await this.prisma.rejoinRequest.create({
          data: {
            meetingId: meeting.id,
            participantId: caller.id,
            message: trimmed,
          },
        });

    const payload = this.toDto(row, caller, meeting.slug);
    this.gateway.broadcastRejoinRequested(meeting.id, {
      requestId: payload.id,
      participantId: payload.participantId,
      displayName: payload.displayName,
      participantType: payload.participantType,
      message: payload.message,
      at: payload.createdAt,
    });
    this.logger.log(`Rejoin requested ${caller.id} → ${slug}`);
    return payload;
  }

  // ── Host: approve / reject ───────────────────────────────────────────

  async approveRequest(
    slug: string,
    callerParticipantId: string,
    requestId: string,
  ): Promise<RejoinRequestDto> {
    return this.resolveRequest(slug, callerParticipantId, requestId, 'APPROVED');
  }

  async rejectRequest(
    slug: string,
    callerParticipantId: string,
    requestId: string,
  ): Promise<RejoinRequestDto> {
    return this.resolveRequest(slug, callerParticipantId, requestId, 'REJECTED');
  }

  /**
   * Helper used by the room endpoint to surface whether the kicked caller
   * already has a pending request (so the client can show "pending" UI).
   */
  async findPendingRequestId(participantId: string): Promise<string | null> {
    const row = await this.prisma.rejoinRequest.findFirst({
      where: { participantId, status: 'PENDING' },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  // ── Internals ────────────────────────────────────────────────────────

  private async resolveRequest(
    slug: string,
    callerParticipantId: string,
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
  ): Promise<RejoinRequestDto> {
    const meeting = await this.loadMeeting(slug);
    const caller = await this.authz.getParticipantInMeeting(meeting.id, callerParticipantId);
    const { userId } = await this.authz.assertCanHost(caller, meeting);

    const row = await this.prisma.rejoinRequest.findUnique({
      where: { id: requestId },
      include: { participant: true },
    });
    if (!row || row.meetingId !== meeting.id) {
      throw new NotFoundException('Rejoin request not found');
    }

    // Idempotent — if already resolved, just return the existing state.
    if (row.status !== 'PENDING') {
      return this.toDto(row, row.participant, meeting.slug);
    }

    const now = new Date();
    const updated = await this.prisma.rejoinRequest.update({
      where: { id: row.id },
      data: { status: decision, resolvedById: userId, resolvedAt: now },
      include: { participant: true },
    });

    if (decision === 'APPROVED') {
      // Clear the kick flag so the next /room call passes and a fresh
      // LiveKit token can be issued. The participant row is reused.
      await this.prisma.meetingParticipant.update({
        where: { id: row.participantId },
        data: { wasKicked: false, kickedAt: null, kickedById: null, leftAt: null },
      });
      this.gateway.broadcastRejoinApproved(meeting.id, {
        requestId: updated.id,
        participantId: updated.participantId,
        displayName: updated.participant.displayNameSnapshot,
        approvedByParticipantId: caller.id,
        at: now.toISOString(),
      });
    } else {
      this.gateway.broadcastRejoinRejected(meeting.id, {
        requestId: updated.id,
        participantId: updated.participantId,
        displayName: updated.participant.displayNameSnapshot,
        rejectedByParticipantId: caller.id,
        at: now.toISOString(),
      });
    }

    this.logger.log(`Rejoin ${decision.toLowerCase()} ${row.participantId} (${slug})`);
    return this.toDto(updated, updated.participant, meeting.slug);
  }

  private async loadMeeting(slug: string) {
    if (!this.codeGen.isValidShape(slug)) {
      throw new NotFoundException('Meeting not found');
    }
    const meeting = await this.prisma.meeting.findUnique({ where: { slug } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }

  private toDto(
    row: {
      id: string;
      meetingId: string;
      participantId: string;
      status: 'PENDING' | 'APPROVED' | 'REJECTED';
      message: string | null;
      createdAt: Date;
      resolvedAt: Date | null;
    },
    participant: MeetingParticipant,
    meetingSlug: string,
  ): RejoinRequestDto {
    return {
      id: row.id,
      meetingId: row.meetingId,
      meetingSlug,
      participantId: row.participantId,
      displayName: participant.displayNameSnapshot,
      participantType: participant.type,
      status: row.status,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
    };
  }
}
