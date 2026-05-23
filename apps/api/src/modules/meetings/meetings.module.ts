import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { AppConfig } from '../../config/configuration';
import { UsersModule } from '../users/users.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { LivekitModule } from '../livekit/livekit.module';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { CodeGeneratorService } from './services/code-generator.service';
import { MeetingAuthService } from './services/meeting-auth.service';
import { HostAuthzService } from './services/host-authz.service';
import { HostActionsService } from './services/host-actions.service';
import { MeetingReportsService } from './services/meeting-reports.service';
import { RejoinRequestsService } from './services/rejoin-requests.service';
import { AutoEndService } from './services/auto-end.service';

@Module({
  imports: [
    UsersModule,
    // RealtimeModule exports MeetingGateway + PresenceService so the Phase 7
    // host-action service can broadcast events + wipe presence state.
    RealtimeModule,
    // LivekitModule already imports MeetingsModule (for MeetingAuthService),
    // so we use forwardRef to break the cycle. HostActionsService injects
    // LivekitService via the same forwardRef in its constructor.
    forwardRef(() => LivekitModule),
    // We need a JwtService to issue guest tokens and verify both access + guest tokens.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        secret: config.get('jwt', { infer: true }).accessSecret,
      }),
    }),
  ],
  controllers: [MeetingsController],
  providers: [
    MeetingsService,
    CodeGeneratorService,
    MeetingAuthService,
    HostAuthzService,
    HostActionsService,
    // Phase 7.6 — reports (history/details/stats), rejoin workflow,
    // and the auto-end Cron job.
    MeetingReportsService,
    RejoinRequestsService,
    AutoEndService,
  ],
  // MeetingAuthService is re-used by the ChatModule's controller for the
  // history endpoint. Exporting JwtModule lets other modules verify tokens
  // without re-registering the secret.
  exports: [MeetingsService, MeetingAuthService, JwtModule],
})
export class MeetingsModule {}
