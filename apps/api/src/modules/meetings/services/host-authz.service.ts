import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Meeting, MeetingParticipant } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';

/**
 * Phase 7 — authorization for host controls.
 *
 * Rules:
 *   - A registered user is a host if EITHER:
 *     * they own the meeting (meeting.hostId === user.id), OR
 *     * they have platform role ADMIN (User.role === 'ADMIN').
 *   - Guests can NEVER be hosts.
 *   - We never look at the client-supplied participant.role to decide —
 *     that field is just a UI hint; this service hits the User row.
 */
@Injectable()
export class HostAuthzService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  /**
   * Throws 403 if the calling participant is not allowed to use host
   * controls on `meeting`. Returns the User row on success so callers can
   * stamp `endedById` / `kickedById` etc.
   */
  async assertCanHost(
    participant: MeetingParticipant,
    meeting: Meeting,
  ): Promise<{ userId: string; isPlatformAdmin: boolean }> {
    if (participant.type !== 'REGISTERED' || !participant.userId) {
      throw new ForbiddenException('Only the host may perform this action');
    }
    const user = await this.users.findById(participant.userId);
    if (!user || !user.isActive) {
      throw new ForbiddenException('Your account is not active');
    }
    const isOwner = meeting.hostId === user.id;
    const isAdmin = user.role === 'ADMIN';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Only the host or an admin may perform this action');
    }
    return { userId: user.id, isPlatformAdmin: isAdmin };
  }

  /**
   * Resolve a participant by id, ensuring it belongs to the given meeting.
   * Throws 404 if not found.
   */
  async getParticipantInMeeting(
    meetingId: string,
    participantId: string,
  ): Promise<MeetingParticipant> {
    const p = await this.prisma.meetingParticipant.findUnique({
      where: { id: participantId },
    });
    if (!p || p.meetingId !== meetingId) {
      throw new NotFoundException('Participant not found in this meeting');
    }
    return p;
  }
}
