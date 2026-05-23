import { forwardRef, Module } from '@nestjs/common';
import { MeetingsModule } from '../meetings/meetings.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { UsersModule } from '../users/users.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

/**
 * Phase 7.7 — file sharing module.
 *
 * Imports:
 *   - MeetingsModule: re-uses MeetingAuthService for guest+bearer auth and
 *     MeetingsService for status / DTO lookups.
 *   - RealtimeModule: MeetingGateway is used to broadcast meeting:file-shared.
 *
 * MeetingsModule is forward-ref'd because the dependency chain
 * (MeetingsModule → RealtimeModule already has a forwardRef) means a
 * direct import here can deadlock during boot; we don't actually need
 * forwardRef in practice but the convention keeps the cycle resilient.
 */
@Module({
  imports: [forwardRef(() => MeetingsModule), RealtimeModule, UsersModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
