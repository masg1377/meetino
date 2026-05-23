import { forwardRef, Module } from '@nestjs/common';
import { MeetingsModule } from '../meetings/meetings.module';
import { LivekitController } from './livekit.controller';
import { LivekitService } from './livekit.service';

/**
 * LiveKit token issuance.
 *
 * Imports MeetingsModule to reuse {@link MeetingAuthService} — same identity
 * resolution we use for the room, chat, and presence layers. No new auth
 * paths, no new trust roots.
 *
 * Phase 7: MeetingsModule depends back on LivekitService (for end / kick),
 * so we use forwardRef here to break the cycle.
 */
@Module({
  imports: [forwardRef(() => MeetingsModule)],
  controllers: [LivekitController],
  providers: [LivekitService],
  exports: [LivekitService],
})
export class LivekitModule {}
