import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Server, Socket } from 'socket.io';
import {
  ChatClientEvent,
  ChatServerEvent,
  RealtimeErrorCode,
  type ChatErrorPayload,
  type ChatMessagePayload,
} from '@meetino/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthedSocketData } from '../realtime/types/socket-data';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

/**
 * Chat gateway — registered on the SAME namespace as MeetingGateway so we
 * share the authenticated `socket.data` snapshot (no second auth pass).
 *
 * Trust model:
 *   - We re-read the MeetingParticipant from the database before saving,
 *     so we use the freshest identity (display name / role / type) on the
 *     persisted row. The client never supplies those fields.
 *   - We require `socket.data.inRoom === true`. That flag flips when the
 *     client emits meeting:join, which itself runs the auth check.
 */
@WebSocketGateway({ namespace: '/realtime' })
export class ChatGateway {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly chat: ChatService,
    private readonly prisma: PrismaService,
  ) {}

  @SubscribeMessage(ChatClientEvent.SEND)
  async onSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const data = socket.data as AuthedSocketData | undefined;
    if (!data?.participantId) {
      this.emitError(socket, RealtimeErrorCode.UNAUTHORIZED, 'Not authenticated');
      return;
    }
    if (!data.inRoom) {
      this.emitError(
        socket,
        RealtimeErrorCode.FORBIDDEN,
        'You must join the meeting before sending messages',
      );
      return;
    }

    // Validate via the DTO (trim + length checks). We run this manually
    // rather than via @UsePipes so we can convert validation failures into
    // a clean `chat:error` frame instead of a generic WS exception.
    const dto = plainToInstance(SendMessageDto, body ?? {});
    const errors = await validate(dto);
    if (errors.length > 0) {
      const first = errors[0]?.constraints;
      const message =
        (first && Object.values(first)[0]) || 'Invalid message payload';
      this.emitError(socket, RealtimeErrorCode.INVALID_PAYLOAD, message);
      return;
    }

    // Defense in depth — the service re-checks the body shape before saving.
    let normalized: string;
    try {
      normalized = this.chat.normalizeBody(dto.body);
    } catch (err) {
      this.emitError(
        socket,
        RealtimeErrorCode.INVALID_PAYLOAD,
        (err as Error).message || 'Invalid message',
      );
      return;
    }

    // Re-fetch the participant so we save the freshest identity snapshot.
    // If the row was deleted out from under us, refuse the send.
    const participant = await this.prisma.meetingParticipant.findUnique({
      where: { id: data.participantId },
    });
    if (!participant || participant.meetingId !== data.meetingId) {
      this.emitError(
        socket,
        RealtimeErrorCode.FORBIDDEN,
        'You are no longer part of this meeting',
      );
      return;
    }

    try {
      const message = await this.chat.saveMessage(participant, normalized);
      const room = this.roomName(data.meetingId);
      const payload: ChatMessagePayload = { message };

      // Broadcast to EVERY socket in the room, including the sender so
      // their UI reflects exactly what was persisted (no optimistic skew).
      this.server.to(room).emit(ChatServerEvent.MESSAGE, payload);
    } catch (err) {
      this.logger.error(`Failed to persist chat: ${(err as Error).message}`);
      this.emitError(
        socket,
        RealtimeErrorCode.INTERNAL,
        'Could not save the message. Please try again.',
      );
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private emitError(socket: Socket, code: RealtimeErrorCode, message: string): void {
    const payload: ChatErrorPayload = { code, message };
    socket.emit(ChatServerEvent.ERROR, payload);
  }

  private roomName(meetingId: string): string {
    return `meeting:${meetingId}`;
  }
}
