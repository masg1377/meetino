import { Module } from '@nestjs/common';
import { MeetingsModule } from '../meetings/meetings.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';

/**
 * Chat module:
 *   - REST: GET /api/meetings/:slug/chat            (controller)
 *   - WS:   chat:send → chat:message / chat:error   (gateway)
 *
 * MeetingsModule provides MeetingAuthService (re-exported) for the HTTP
 * history endpoint. The gateway re-uses socket.data set by MeetingGateway.
 */
@Module({
  imports: [MeetingsModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
