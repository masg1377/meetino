import { forwardRef, Inject, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import {
  MeetingClientEvent,
  MeetingServerEvent,
  RealtimeErrorCode,
  type MeetingErrorPayload,
  type MeetingFileDeletedPayload,
  type MeetingFileSharedPayload,
  type ParticipantJoinedPayload,
  type ParticipantLeftPayload,
  type ParticipantRejoinApprovedPayload,
  type ParticipantRejoinRejectedPayload,
  type ParticipantRejoinRequestedPayload,
  type ParticipantStateUpdatedPayload,
  type ParticipantsUpdatedPayload,
  type WhiteboardClearPayload,
  type WhiteboardOp,
  type WhiteboardOpPayload,
} from '@meetino/shared';
import { MeetingsService } from '../meetings/meetings.service';
import { PresenceService } from './services/presence.service';
import { SocketAuthService } from './services/socket-auth.service';
import { MeetingWhiteboardService } from './services/whiteboard.service';
import type { AuthedSocketData } from './types/socket-data';

/**
 * Realtime gateway for meeting rooms.
 *
 * Namespace: `/realtime`. CORS, ping intervals, and other server-wide
 * options are configured by {@link MeetinoIoAdapter} in main.ts.
 *
 * Auth contract:
 *   - Client must connect with handshake.auth.slug = "<meeting slug>"
 *   - Either handshake.auth.token = "<access JWT>" (registered users)
 *     OR the meetino_guest cookie (guests).
 *   - We verify the participant row exists for that slug before letting
 *     the socket stay connected. No client-provided role/type is trusted.
 *
 * Events:
 *   C→S: meeting:join, meeting:leave,
 *        participant:mic-toggle, participant:camera-toggle
 *   S→C: meeting:participant-joined, meeting:participant-left,
 *        meeting:participants-updated, participant:state-updated,
 *        meeting:error
 */
@WebSocketGateway({ namespace: '/realtime' })
export class MeetingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MeetingGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly socketAuth: SocketAuthService,
    private readonly presence: PresenceService,
    // Phase 7.6 — touch lastActivityAt and record attendance leaves.
    // forwardRef breaks the MeetingsModule ↔ RealtimeModule cycle.
    @Inject(forwardRef(() => MeetingsService))
    private readonly meetings: MeetingsService,
    // Phase 7.7 — buffered persistence of whiteboard ops.
    private readonly whiteboard: MeetingWhiteboardService,
  ) {}

  // ── Connection lifecycle ────────────────────────────────────────────

  /**
   * Authenticate via namespace middleware — runs BEFORE the connect ack
   * is sent. This is critical: if we did the lookup inside handleConnection,
   * the client receives `connect` immediately and can emit `meeting:join`
   * before our async DB query finishes, racing past empty `socket.data`.
   *
   * The middleware sets socket.data to the AuthedSocketData snapshot on
   * success, or calls next(Error) to reject the connection (the client
   * sees a `connect_error` event with the message).
   */
  afterInit(server: Server): void {
    server.use(async (socket, next) => {
      try {
        const slug = this.readSlug(socket);
        if (!slug) {
          return next(new Error('Missing meeting slug'));
        }
        const authed = await this.socketAuth.authenticate(socket, slug);
        if (!authed) {
          return next(new Error('You are not allowed to join this meeting'));
        }
        socket.data = authed satisfies AuthedSocketData;
        next();
      } catch (err) {
        this.logger.error(`Auth middleware failure: ${(err as Error).message}`);
        next(new Error('Authentication failed'));
      }
    });
  }

  handleConnection(socket: Socket): void {
    // By the time we get here, the middleware has already populated socket.data.
    // This handler is now just for logging.
    const data = socket.data as AuthedSocketData | undefined;
    if (!data) {
      // Defensive — shouldn't happen because middleware would have rejected.
      socket.disconnect(true);
      return;
    }
    this.logger.log(
      `Socket connected ${socket.id} → ${data.slug} (${data.role}/${data.type})`,
    );
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    const data = socket.data as Partial<AuthedSocketData> | undefined;
    if (!data?.participantId || !data.slug || !data.meetingId || !data.inRoom) {
      return;
    }

    const room = this.roomName(data.meetingId);
    const { state, wentOffline } = await this.presence.removeConnection(
      data.slug,
      data.participantId,
    );

    if (wentOffline) {
      // Broadcast a state patch so the rest of the room can dim the avatar.
      const patch: ParticipantStateUpdatedPayload = {
        participantId: data.participantId,
        patch: {
          isOnline: false,
          lastSeenAt: state?.lastSeenAt ?? new Date().toISOString(),
        },
      };
      this.server.to(room).emit(MeetingServerEvent.STATE_UPDATED, patch);
      const left: ParticipantLeftPayload = { participantId: data.participantId };
      this.server.to(room).emit(MeetingServerEvent.PARTICIPANT_LEFT, left);

      // Phase 7.6 — persist attendance for the closed session.
      await this.meetings.recordParticipantLeft(data.participantId);
    } else {
      // Multi-tab close (other tabs still open) — at least mark activity.
      await this.meetings.touchActivity(data.meetingId);
    }

    this.logger.log(`Socket disconnected ${socket.id} (wentOffline=${wentOffline})`);
  }

  // ── Client → Server handlers ────────────────────────────────────────

  @SubscribeMessage(MeetingClientEvent.JOIN)
  async onJoin(@ConnectedSocket() socket: Socket): Promise<void> {
    const data = socket.data as AuthedSocketData | undefined;
    if (!data?.participantId) {
      this.fail(socket, RealtimeErrorCode.UNAUTHORIZED, 'Not authenticated', false);
      return;
    }
    if (data.inRoom) {
      // Idempotent — just re-send the snapshot so client can recover.
      await this.emitSnapshot(socket);
      return;
    }

    const { state, wasNewlyOnline } = await this.presence.addConnection({
      slug: data.slug,
      participantId: data.participantId,
      displayName: data.displayName,
      role: data.role,
      type: data.type,
      userId: data.userId,
    });

    data.inRoom = true;
    const room = this.roomName(data.meetingId);
    await socket.join(room);

    if (wasNewlyOnline) {
      // First socket for this participant — announce to peers.
      const joined: ParticipantJoinedPayload = { participant: state };
      socket.to(room).emit(MeetingServerEvent.PARTICIPANT_JOINED, joined);
    } else {
      // Reconnect / second tab — flip them back to online for everyone.
      const patch: ParticipantStateUpdatedPayload = {
        participantId: data.participantId,
        patch: { isOnline: true, lastSeenAt: null },
      };
      socket.to(room).emit(MeetingServerEvent.STATE_UPDATED, patch);
    }

    // Tell the joiner who's already here (including themselves).
    await this.emitSnapshot(socket);

    // Phase 7.6 — auto-end heuristics rely on lastActivityAt.
    await this.meetings.touchActivity(data.meetingId);

    this.logger.log(`Participant joined room ${data.slug}: ${data.displayName}`);
  }

  @SubscribeMessage(MeetingClientEvent.LEAVE)
  async onLeave(@ConnectedSocket() socket: Socket): Promise<void> {
    const data = socket.data as AuthedSocketData | undefined;
    if (!data?.participantId || !data.inRoom) return;

    const room = this.roomName(data.meetingId);

    // Hard-forget so the avatar disappears from peers' lists. The participant
    // row in Postgres is preserved (history) — we only clear runtime state.
    await this.presence.forgetParticipant(data.slug, data.participantId);
    data.inRoom = false;
    await socket.leave(room);

    const left: ParticipantLeftPayload = { participantId: data.participantId };
    this.server.to(room).emit(MeetingServerEvent.PARTICIPANT_LEFT, left);

    // Also refresh everyone's list so removed rows clear in one round-trip.
    const updated: ParticipantsUpdatedPayload = {
      participants: await this.presence.listParticipants(data.slug),
    };
    this.server.to(room).emit(MeetingServerEvent.PARTICIPANTS_UPDATED, updated);

    // Phase 7.6 — finalize this attendance row + touch meeting activity.
    await this.meetings.recordParticipantLeft(data.participantId);
  }

  @SubscribeMessage(MeetingClientEvent.MIC_TOGGLE)
  async onMicToggle(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const enabled = this.readBool(body, 'enabled');
    if (enabled === null) {
      this.fail(socket, RealtimeErrorCode.INVALID_PAYLOAD, 'enabled must be boolean', false);
      return;
    }
    await this.applyMediaFlag(socket, 'micEnabled', enabled);
  }

  @SubscribeMessage(MeetingClientEvent.CAMERA_TOGGLE)
  async onCameraToggle(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const enabled = this.readBool(body, 'enabled');
    if (enabled === null) {
      this.fail(socket, RealtimeErrorCode.INVALID_PAYLOAD, 'enabled must be boolean', false);
      return;
    }
    await this.applyMediaFlag(socket, 'cameraEnabled', enabled);
  }

  // ── Phase 7.7 — Whiteboard ────────────────────────────────────────

  /**
   * One drawing op (stroke / shape / text). Broadcast to peers and queued
   * for persistence so late-joiners can replay. The originating client
   * also applies it optimistically — we don't echo it back to them.
   */
  @SubscribeMessage(MeetingClientEvent.WHITEBOARD_OP)
  async onWhiteboardOp(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const data = socket.data as AuthedSocketData | undefined;
    if (!data?.participantId || !data.inRoom) {
      this.fail(socket, RealtimeErrorCode.FORBIDDEN, 'Join the meeting first', false);
      return;
    }
    const op = this.sanitizeWhiteboardOp(body, data.participantId);
    if (!op) {
      this.fail(socket, RealtimeErrorCode.INVALID_PAYLOAD, 'Invalid whiteboard op', false);
      return;
    }
    const payload: WhiteboardOpPayload = { op };
    socket.to(this.roomName(data.meetingId)).emit(
      MeetingServerEvent.WHITEBOARD_OP,
      payload,
    );
    this.whiteboard.recordOp(data.meetingId, op);
  }

  /** Clear the board for everyone — also wipes the persisted snapshot. */
  @SubscribeMessage(MeetingClientEvent.WHITEBOARD_CLEAR)
  async onWhiteboardClear(@ConnectedSocket() socket: Socket): Promise<void> {
    const data = socket.data as AuthedSocketData | undefined;
    if (!data?.participantId || !data.inRoom) {
      this.fail(socket, RealtimeErrorCode.FORBIDDEN, 'Join the meeting first', false);
      return;
    }
    const payload: WhiteboardClearPayload = {
      byParticipantId: data.participantId,
      at: new Date().toISOString(),
    };
    this.server.to(this.roomName(data.meetingId)).emit(
      MeetingServerEvent.WHITEBOARD_CLEAR,
      payload,
    );
    await this.whiteboard.clear(data.meetingId);
  }

  /**
   * Late-joiners ask for the snapshot once. Reply directly to the caller
   * so the rest of the room doesn't re-receive their own state.
   */
  @SubscribeMessage(MeetingClientEvent.WHITEBOARD_SNAPSHOT_REQUEST)
  async onWhiteboardSnapshotRequest(@ConnectedSocket() socket: Socket): Promise<void> {
    const data = socket.data as AuthedSocketData | undefined;
    if (!data?.participantId || !data.inRoom) {
      this.fail(socket, RealtimeErrorCode.FORBIDDEN, 'Join the meeting first', false);
      return;
    }
    const snapshot = await this.whiteboard.getSnapshot(data.meetingId);
    socket.emit(MeetingServerEvent.WHITEBOARD_SNAPSHOT, snapshot);
  }

  // ── Internals ───────────────────────────────────────────────────────

  private async applyMediaFlag(
    socket: Socket,
    flag: 'micEnabled' | 'cameraEnabled',
    enabled: boolean,
  ): Promise<void> {
    const data = socket.data as AuthedSocketData | undefined;
    if (!data?.participantId || !data.inRoom) {
      this.fail(socket, RealtimeErrorCode.FORBIDDEN, 'Join the meeting first', false);
      return;
    }

    const state = await this.presence.setMediaFlag(
      data.slug,
      data.participantId,
      flag,
      enabled,
    );
    if (!state) {
      this.fail(socket, RealtimeErrorCode.NOT_FOUND, 'Participant state missing', false);
      return;
    }

    const room = this.roomName(data.meetingId);
    const payload: ParticipantStateUpdatedPayload = {
      participantId: data.participantId,
      patch: { [flag]: enabled },
    };
    this.server.to(room).emit(MeetingServerEvent.STATE_UPDATED, payload);
  }

  /** Reply with the full participant list to a single socket. */
  private async emitSnapshot(socket: Socket): Promise<void> {
    const data = socket.data as AuthedSocketData | undefined;
    if (!data) return;
    const payload: ParticipantsUpdatedPayload = {
      participants: await this.presence.listParticipants(data.slug),
    };
    socket.emit(MeetingServerEvent.PARTICIPANTS_UPDATED, payload);
  }

  /** Emit error then optionally disconnect. */
  private fail(
    socket: Socket,
    code: RealtimeErrorCode,
    message: string,
    disconnect = true,
  ): void {
    const payload: MeetingErrorPayload = { code, message };
    socket.emit(MeetingServerEvent.ERROR, payload);
    if (disconnect) socket.disconnect(true);
  }

  private readSlug(socket: Socket): string | null {
    const auth = socket.handshake.auth as { slug?: unknown } | undefined;
    if (auth?.slug && typeof auth.slug === 'string') return auth.slug;
    const q = socket.handshake.query?.slug;
    if (typeof q === 'string') return q;
    return null;
  }

  private readBool(body: unknown, field: string): boolean | null {
    if (body && typeof body === 'object' && field in body) {
      const v = (body as Record<string, unknown>)[field];
      if (typeof v === 'boolean') return v;
    }
    return null;
  }

  private roomName(meetingId: string): string {
    return `meeting:${meetingId}`;
  }

  /**
   * Phase 7.7 — defensive whiteboard-op validator. Clients can submit any
   * JSON, so we re-shape the payload to a strict, server-trusted op.
   *
   *   - Drops absurdly large strokes (> 4096 points) to bound memory.
   *   - Forces authorId to the socket's participantId so a client can't
   *     spoof another author on the wire.
   *   - Coerces color/size/text to safe primitives.
   */
  private sanitizeWhiteboardOp(body: unknown, authorId: string): WhiteboardOp | null {
    if (!body || typeof body !== 'object') return null;
    const raw = (body as { op?: unknown }).op;
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;

    const tool = o.tool;
    if (
      tool !== 'pen' &&
      tool !== 'eraser' &&
      tool !== 'text' &&
      tool !== 'line' &&
      tool !== 'rect' &&
      tool !== 'circle'
    ) {
      return null;
    }

    const id = typeof o.id === 'string' && o.id.length > 0 && o.id.length <= 64 ? o.id : null;
    if (!id) return null;

    const color = typeof o.color === 'string' && o.color.length <= 32 ? o.color : '#000000';
    const sizeNum = typeof o.size === 'number' && Number.isFinite(o.size) ? o.size : 2;
    const size = Math.min(64, Math.max(1, Math.round(sizeNum)));

    const points = Array.isArray(o.points)
      ? (o.points
          .filter((p) => p && typeof p === 'object')
          .map((p) => p as Record<string, unknown>)
          .filter((p) => typeof p.x === 'number' && typeof p.y === 'number')
          .map((p) => ({ x: p.x as number, y: p.y as number }))
          .slice(0, 4096))
      : [];

    if (tool !== 'text' && points.length === 0) return null;

    const text =
      tool === 'text' && typeof o.text === 'string'
        ? o.text.slice(0, 240)
        : undefined;

    return {
      id,
      tool,
      color,
      size,
      points,
      ...(text !== undefined ? { text } : {}),
      authorId,
      createdAt: new Date().toISOString(),
    };
  }

  // ── Phase 7.7 — broadcast helpers called by HTTP handlers ───────────

  /** File-sharing controller calls this after a successful upload. */
  broadcastFileShared(meetingId: string, payload: MeetingFileSharedPayload): void {
    this.server.to(this.roomName(meetingId)).emit(
      MeetingServerEvent.FILE_SHARED,
      payload,
    );
  }

  /** File-sharing controller calls this after a successful delete. */
  broadcastFileDeleted(meetingId: string, payload: MeetingFileDeletedPayload): void {
    this.server.to(this.roomName(meetingId)).emit(
      MeetingServerEvent.FILE_DELETED,
      payload,
    );
  }

  // ── Phase 7: security broadcasts called by MeetingsService ──────────

  /** Broadcast that the meeting has been locked. */
  broadcastLocked(meetingId: string, payload: { at: string }): void {
    this.server.to(this.roomName(meetingId)).emit('meeting:locked', payload);
  }

  /** Broadcast that the meeting has been unlocked. */
  broadcastUnlocked(meetingId: string, payload: { at: string }): void {
    this.server.to(this.roomName(meetingId)).emit('meeting:unlocked', payload);
  }

  /**
   * Broadcast that the meeting has ended for everyone, then disconnect
   * every socket in the room so they can't accidentally keep emitting.
   */
  async broadcastEnded(
    meetingId: string,
    payload: { at: string; endedByParticipantId: string | null },
  ): Promise<void> {
    const room = this.roomName(meetingId);
    this.server.to(room).emit('meeting:ended', payload);
    // Give the client a tick to receive the event before we close them.
    const sockets = await this.server.in(room).fetchSockets();
    for (const s of sockets) {
      try {
        s.disconnect(true);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Phase 7.6 — emit a rejoin request to the room. Practically only host
   * UIs will care, but we broadcast to the whole room so multiple host
   * tabs and admins all see the same prompt.
   */
  broadcastRejoinRequested(
    meetingId: string,
    payload: ParticipantRejoinRequestedPayload,
  ): void {
    this.server.to(this.roomName(meetingId)).emit(
      MeetingServerEvent.REJOIN_REQUESTED,
      payload,
    );
  }

  /** Phase 7.6 — emit approval to the whole room. */
  broadcastRejoinApproved(
    meetingId: string,
    payload: ParticipantRejoinApprovedPayload,
  ): void {
    this.server.to(this.roomName(meetingId)).emit(
      MeetingServerEvent.REJOIN_APPROVED,
      payload,
    );
  }

  /** Phase 7.6 — emit rejection to the whole room. */
  broadcastRejoinRejected(
    meetingId: string,
    payload: ParticipantRejoinRejectedPayload,
  ): void {
    this.server.to(this.roomName(meetingId)).emit(
      MeetingServerEvent.REJOIN_REJECTED,
      payload,
    );
  }

  /**
   * Broadcast that a single participant was kicked, then forcibly close
   * every socket currently held by that participant.
   */
  async broadcastKicked(
    meetingId: string,
    payload: {
      participantId: string;
      displayName: string;
      kickedByParticipantId: string | null;
      at: string;
    },
  ): Promise<void> {
    const room = this.roomName(meetingId);
    this.server.to(room).emit('participant:kicked', payload);

    // Also drop the kicked participant from presence + room subscription.
    const sockets = await this.server.in(room).fetchSockets();
    for (const s of sockets) {
      const data = s.data as { participantId?: string } | undefined;
      if (data?.participantId === payload.participantId) {
        try {
          s.disconnect(true);
        } catch {
          // ignore
        }
      }
    }
  }
}
