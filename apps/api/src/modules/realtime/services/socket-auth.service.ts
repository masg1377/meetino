import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Socket } from 'socket.io';
import type { AppConfig } from '../../../config/configuration';
import { PrismaService } from '../../../prisma/prisma.service';
import type { JwtPayload } from '../../auth/types/jwt-payload';
import type { GuestTokenPayload } from '../../meetings/types/guest-token';
import { GUEST_COOKIE } from '../../meetings/services/meeting-auth.service';
import type { AuthedSocketData } from '../types/socket-data';

/**
 * Authenticates an incoming socket connection for a given meeting slug.
 *
 * Two acceptance paths (same security model as Phase 3):
 *   1. handshake.auth.token = "<access JWT>"   → REGISTERED participant
 *   2. meetino_guest cookie in handshake       → GUEST participant
 *
 * In both cases we look up a real MeetingParticipant row before trusting
 * the slug. Roles and types come from the database — never from the client.
 */
@Injectable()
export class SocketAuthService {
  private readonly logger = new Logger(SocketAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Resolves an AuthedSocketData snapshot or returns null if the socket
   * is not allowed to connect to this slug.
   */
  async authenticate(socket: Socket, slug: string): Promise<AuthedSocketData | null> {
    if (!slug || typeof slug !== 'string') return null;

    const jwtCfg = this.config.get('jwt', { infer: true });

    // Path 1: registered (bearer)
    const bearer = this.extractBearer(socket);
    if (bearer) {
      try {
        const payload = await this.jwt.verifyAsync<JwtPayload>(bearer, {
          secret: jwtCfg.accessSecret,
        });
        if (payload.type === 'access') {
          const participant = await this.prisma.meetingParticipant.findFirst({
            where: { userId: payload.sub, meeting: { slug } },
            include: { meeting: { select: { id: true, slug: true } } },
          });
          if (participant && participant.meeting.slug === slug) {
            // Phase 7.6 — kicked participants must not be able to maintain
            // a gateway socket (otherwise their client would keep auto-
            // reconnecting and slip back into presence after a kick).
            // The /room endpoint still works for them via HTTP so they
            // can see the rejoin UI.
            if (participant.wasKicked) {
              this.logger.debug?.(`Rejected kicked participant ${participant.id}`);
              return null;
            }
            return {
              participantId: participant.id,
              meetingId: participant.meetingId,
              slug,
              displayName: participant.displayNameSnapshot,
              role: participant.role,
              type: participant.type,
              userId: participant.userId,
              inRoom: false,
            };
          }
        }
      } catch (err) {
        // fall through to guest path
        this.logger.debug?.(`Bearer auth failed: ${(err as Error).message}`);
      }
    }

    // Path 2: guest (cookie)
    const guestRaw = this.extractGuestCookie(socket);
    if (guestRaw) {
      try {
        const payload = await this.jwt.verifyAsync<GuestTokenPayload>(guestRaw, {
          secret: jwtCfg.accessSecret,
        });
        if (payload.type === 'guest' && payload.room === slug) {
          const participant = await this.prisma.meetingParticipant.findUnique({
            where: { id: payload.sub },
            include: { meeting: { select: { id: true, slug: true } } },
          });
          if (participant && participant.meeting.slug === slug) {
            // Phase 7.6 — same kick guard for guests.
            if (participant.wasKicked) {
              this.logger.debug?.(`Rejected kicked guest ${participant.id}`);
              return null;
            }
            return {
              participantId: participant.id,
              meetingId: participant.meetingId,
              slug,
              displayName: participant.displayNameSnapshot,
              role: participant.role,
              type: participant.type,
              userId: participant.userId,
              inRoom: false,
            };
          }
        }
      } catch (err) {
        this.logger.debug?.(`Guest auth failed: ${(err as Error).message}`);
      }
    }

    return null;
  }

  private extractBearer(socket: Socket): string | null {
    const auth = socket.handshake.auth as { token?: unknown } | undefined;
    if (auth?.token && typeof auth.token === 'string') return auth.token;
    const header = socket.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7);
    return null;
  }

  private extractGuestCookie(socket: Socket): string | null {
    // Prefer explicit handshake.auth.guestToken if provided (useful in tests).
    const auth = socket.handshake.auth as { guestToken?: unknown } | undefined;
    if (auth?.guestToken && typeof auth.guestToken === 'string') return auth.guestToken;

    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader || typeof cookieHeader !== 'string') return null;
    const parts = cookieHeader.split(';').map((c) => c.trim());
    for (const part of parts) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      const name = part.slice(0, eq).trim();
      if (name === GUEST_COOKIE) {
        return decodeURIComponent(part.slice(eq + 1).trim());
      }
    }
    return null;
  }
}
