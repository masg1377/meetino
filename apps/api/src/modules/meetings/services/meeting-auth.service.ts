import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { MeetingParticipant } from '@prisma/client';
import type { AppConfig } from '../../../config/configuration';
import { PrismaService } from '../../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import type { JwtPayload } from '../../auth/types/jwt-payload';
import type { GuestTokenPayload } from '../types/guest-token';

export const GUEST_COOKIE = 'meetino_guest';

/**
 * Resolves the calling participant for a given meeting slug.
 * Tries (in order):
 *   1. Authorization: Bearer <access JWT>  → registered participant
 *   2. Cookie: meetino_guest                → guest participant
 * Throws 401 if neither resolves to an active participant for THIS slug.
 */
@Injectable()
export class MeetingAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async resolveParticipant(
    req: Request,
    slug: string,
  ): Promise<MeetingParticipant> {
    const jwtCfg = this.config.get('jwt', { infer: true });

    // Path 1: registered user via bearer
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
          secret: jwtCfg.accessSecret,
        });
        if (payload.type === 'access') {
          const user = await this.users.findById(payload.sub);
          if (user && user.isActive) {
            const participant = await this.prisma.meetingParticipant.findFirst({
              where: {
                userId: user.id,
                meeting: { slug },
              },
            });
            if (participant) return participant;
          }
        }
      } catch {
        // fall through to guest cookie path
      }
    }

    // Path 2: guest via cookie
    const guestTokenRaw = req.cookies?.[GUEST_COOKIE];
    if (guestTokenRaw) {
      try {
        const payload = await this.jwt.verifyAsync<GuestTokenPayload>(guestTokenRaw, {
          secret: jwtCfg.accessSecret,
        });
        if (payload.type === 'guest' && payload.room === slug) {
          const participant = await this.prisma.meetingParticipant.findUnique({
            where: { id: payload.sub },
          });
          if (participant) {
            // Verify the participant actually belongs to a meeting with this slug.
            const meeting = await this.prisma.meeting.findUnique({
              where: { id: participant.meetingId },
              select: { slug: true },
            });
            if (meeting?.slug === slug) return participant;
          }
        }
      } catch {
        // fall through to throw below
      }
    }

    throw new UnauthorizedException('You must join this meeting first');
  }
}
