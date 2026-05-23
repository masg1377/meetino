import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MeetingParticipant } from '@prisma/client';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import type {
  LivekitParticipantMetadata,
  LivekitTokenResponse,
} from '@meetino/shared';
import type { AppConfig } from '../../config/configuration';

/**
 * LiveKit token minter.
 *
 * Identity rules:
 *   - Token `identity` is the MeetingParticipant.id from our DB. The
 *     client cannot influence it; we look up the participant via the
 *     bearer / guest-cookie path established in Phase 3.
 *   - Metadata is a JSON snapshot of role/type/display name so peers
 *     can render badges without an extra API hit.
 *   - The grant is scoped to ONE room (the meeting slug). Re-using the
 *     token in another room is rejected by the SFU.
 */
@Injectable()
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  async issueToken(
    participant: MeetingParticipant,
    meetingSlug: string,
  ): Promise<LivekitTokenResponse> {
    const lk = this.config.get('livekit', { infer: true });
    if (!lk.apiKey || !lk.apiSecret) {
      // Boot-time Joi validation should prevent this, but belt-and-suspenders.
      throw new InternalServerErrorException('LiveKit is not configured');
    }

    const metadata: LivekitParticipantMetadata = {
      participantId: participant.id,
      displayName: participant.displayNameSnapshot,
      role: participant.role,
      type: participant.type,
      userId: participant.userId,
    };

    const at = new AccessToken(lk.apiKey, lk.apiSecret, {
      identity: participant.id,
      name: participant.displayNameSnapshot,
      ttl: lk.tokenTtlMinutes * 60, // seconds
      metadata: JSON.stringify(metadata),
    });

    at.addGrant({
      room: meetingSlug,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      // Screen sharing rides on the same canPublish flag; no extra grant
      // is needed for Phase 6.
    });

    const token = await at.toJwt();

    this.logger.log(
      `Issued LiveKit token for ${participant.id} (${participant.role}/${participant.type}) → room ${meetingSlug}`,
    );

    return {
      token,
      url: lk.url,
      room: meetingSlug,
      identity: participant.id,
    };
  }

  // ── Phase 7: room admin via RoomServiceClient ─────────────────────

  /**
   * Forcibly disconnect a participant from the LiveKit room. Non-fatal:
   * if the SFU isn't reachable we log and continue so the DB state still
   * reflects the kick — peers see the WS event regardless.
   */
  async removeParticipant(roomName: string, identity: string): Promise<void> {
    try {
      const client = this.getRoomServiceClient();
      await client.removeParticipant(roomName, identity);
      this.logger.log(`LiveKit: removed ${identity} from ${roomName}`);
    } catch (err) {
      this.logger.warn(
        `LiveKit removeParticipant failed for ${identity}@${roomName}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Delete a LiveKit room — disconnects everyone. Used when the host ends
   * the meeting. Non-fatal for the same reason.
   */
  async deleteRoom(roomName: string): Promise<void> {
    try {
      const client = this.getRoomServiceClient();
      await client.deleteRoom(roomName);
      this.logger.log(`LiveKit: deleted room ${roomName}`);
    } catch (err) {
      this.logger.warn(
        `LiveKit deleteRoom failed for ${roomName}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * RoomServiceClient talks HTTP, not WebSocket. Translate the URL we
   * advertise to clients (ws://) into the HTTP form (http://) the SDK
   * expects. wss:// → https:// for production.
   */
  private getRoomServiceClient(): RoomServiceClient {
    const lk = this.config.get('livekit', { infer: true });
    if (!lk.apiKey || !lk.apiSecret) {
      throw new InternalServerErrorException('LiveKit is not configured');
    }
    const httpUrl = lk.url
      .replace(/^ws:\/\//i, 'http://')
      .replace(/^wss:\/\//i, 'https://');
    return new RoomServiceClient(httpUrl, lk.apiKey, lk.apiSecret);
  }
}
