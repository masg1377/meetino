import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { AppConfig } from '../../config/configuration';
import { MeetingsModule } from '../meetings/meetings.module';
import { MeetingGateway } from './meeting.gateway';
import { PresenceService } from './services/presence.service';
import { SocketAuthService } from './services/socket-auth.service';
import { MeetingWhiteboardService } from './services/whiteboard.service';

/**
 * Realtime layer. Mounts the meeting WebSocket gateway and its supporting
 * services. PrismaModule and RedisModule are @Global() so we don't import them.
 *
 * Phase 7.6: the gateway also calls MeetingsService.touchActivity /
 * recordParticipantLeft on online/offline transitions so attendance and
 * auto-end heuristics stay accurate. MeetingsModule already imports
 * RealtimeModule, so we break the cycle with forwardRef.
 */
@Module({
  imports: [
    forwardRef(() => MeetingsModule),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        secret: config.get('jwt', { infer: true }).accessSecret,
      }),
    }),
  ],
  providers: [MeetingGateway, SocketAuthService, PresenceService, MeetingWhiteboardService],
  // Phase 7: MeetingsService calls into MeetingGateway to broadcast
  // locked / unlocked / ended / kicked events to participants. Also
  // exports PresenceService so kick can wipe Redis state directly.
  // Phase 7.7: export MeetingGateway already covers whiteboard helpers
  // (they hang off the gateway); the file-sharing controller imports
  // RealtimeModule directly for the broadcast helper.
  exports: [MeetingGateway, PresenceService, MeetingWhiteboardService],
})
export class RealtimeModule {}
