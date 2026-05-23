import { Injectable, Logger } from '@nestjs/common';
import type {
  ParticipantState,
  ParticipantRole,
  ParticipantType,
} from '@meetino/shared';
import { RedisService } from '../../../redis/redis.service';

/**
 * Realtime presence + state for participants in a meeting.
 *
 * Source of truth: Redis. One hash per meeting, one field per participant.
 *
 *   key: meetino:room:<slug>:state
 *   field: <participantId>
 *   value: JSON-serialized {@link StoredParticipantState}
 *
 * `connectionCount` lives inside the JSON value so a tab-rich user can
 * close one tab without flipping isOnline to false. We treat each socket
 * write as cooperative: only the owner's gateway connection mutates
 * their own field, so concurrent writes on the same field are rare.
 *
 * The data is intentionally ephemeral. When a meeting ends, the hash can
 * just be deleted (left to a later phase).
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  constructor(private readonly redis: RedisService) {}

  /** TTL for the entire room hash. Refreshed on every write. */
  private static readonly ROOM_TTL_SECONDS = 12 * 60 * 60; // 12h

  private roomKey(slug: string): string {
    return `meetino:room:${slug}:state`;
  }

  /**
   * Idempotently mark a participant as connected. If this is the first
   * socket for the participant, the row is created (or revived).
   * Returns the resulting public state + whether this was a fresh join.
   */
  async addConnection(args: {
    slug: string;
    participantId: string;
    displayName: string;
    role: ParticipantRole;
    type: ParticipantType;
    userId: string | null;
  }): Promise<{ state: ParticipantState; wasNewlyOnline: boolean }> {
    const key = this.roomKey(args.slug);
    const client = this.redis.getClient();
    const existing = await this.read(args.slug, args.participantId);

    const now = new Date().toISOString();
    const next: StoredParticipantState = existing
      ? {
          ...existing,
          // Identity fields refreshed from DB on every reconnect (display name
          // could have been changed by the participant; keep our copy in sync).
          displayName: args.displayName,
          role: args.role,
          type: args.type,
          userId: args.userId,
          connectionCount: existing.connectionCount + 1,
          lastSeenAt: null,
        }
      : {
          participantId: args.participantId,
          displayName: args.displayName,
          role: args.role,
          type: args.type,
          userId: args.userId,
          micEnabled: false,
          cameraEnabled: false,
          connectionCount: 1,
          joinedAt: now,
          lastSeenAt: null,
        };

    await client.hset(key, args.participantId, JSON.stringify(next));
    await client.expire(key, PresenceService.ROOM_TTL_SECONDS);

    return {
      state: this.toPublic(next),
      wasNewlyOnline: !existing || existing.connectionCount === 0,
    };
  }

  /**
   * Drop one socket for a participant. If it was their last socket, mark
   * them offline and stamp lastSeenAt. Returns the resulting public state,
   * or null if the participant no longer exists in the room.
   */
  async removeConnection(
    slug: string,
    participantId: string,
  ): Promise<{ state: ParticipantState | null; wentOffline: boolean }> {
    const key = this.roomKey(slug);
    const client = this.redis.getClient();
    const existing = await this.read(slug, participantId);
    if (!existing) return { state: null, wentOffline: false };

    const nextCount = Math.max(0, existing.connectionCount - 1);
    const next: StoredParticipantState = {
      ...existing,
      connectionCount: nextCount,
      lastSeenAt: nextCount === 0 ? new Date().toISOString() : existing.lastSeenAt,
    };

    await client.hset(key, participantId, JSON.stringify(next));
    await client.expire(key, PresenceService.ROOM_TTL_SECONDS);

    return {
      state: this.toPublic(next),
      wentOffline: existing.connectionCount > 0 && nextCount === 0,
    };
  }

  /**
   * Hard-remove a participant from the room (e.g. explicit meeting:leave).
   * Returns the last known public state for use in farewell broadcasts.
   */
  async forgetParticipant(
    slug: string,
    participantId: string,
  ): Promise<ParticipantState | null> {
    const key = this.roomKey(slug);
    const client = this.redis.getClient();
    const existing = await this.read(slug, participantId);
    if (!existing) return null;
    await client.hdel(key, participantId);
    return this.toPublic({
      ...existing,
      connectionCount: 0,
      lastSeenAt: new Date().toISOString(),
    });
  }

  /** Owner-driven flag update. Only the owning gateway should call this. */
  async setMediaFlag(
    slug: string,
    participantId: string,
    flag: 'micEnabled' | 'cameraEnabled',
    enabled: boolean,
  ): Promise<ParticipantState | null> {
    const key = this.roomKey(slug);
    const client = this.redis.getClient();
    const existing = await this.read(slug, participantId);
    if (!existing) return null;

    const next: StoredParticipantState = { ...existing, [flag]: enabled };
    await client.hset(key, participantId, JSON.stringify(next));
    await client.expire(key, PresenceService.ROOM_TTL_SECONDS);
    return this.toPublic(next);
  }

  /** Snapshot of every participant currently tracked in the room. */
  async listParticipants(slug: string): Promise<ParticipantState[]> {
    const key = this.roomKey(slug);
    const client = this.redis.getClient();
    const raw = await client.hgetall(key);
    const result: ParticipantState[] = [];
    for (const value of Object.values(raw)) {
      const parsed = this.parse(value);
      if (parsed) result.push(this.toPublic(parsed));
    }
    return result;
  }

  // ── Internals ────────────────────────────────────────────────────

  private async read(
    slug: string,
    participantId: string,
  ): Promise<StoredParticipantState | null> {
    const client = this.redis.getClient();
    const raw = await client.hget(this.roomKey(slug), participantId);
    return this.parse(raw);
  }

  private parse(raw: string | null): StoredParticipantState | null {
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw) as StoredParticipantState;
      if (!obj || typeof obj !== 'object' || !obj.participantId) return null;
      return obj;
    } catch (err) {
      this.logger.warn(`Corrupt presence row dropped: ${(err as Error).message}`);
      return null;
    }
  }

  private toPublic(s: StoredParticipantState): ParticipantState {
    return {
      participantId: s.participantId,
      displayName: s.displayName,
      role: s.role,
      type: s.type,
      userId: s.userId,
      isOnline: s.connectionCount > 0,
      micEnabled: s.micEnabled,
      cameraEnabled: s.cameraEnabled,
      lastSeenAt: s.lastSeenAt,
      joinedAt: s.joinedAt,
    };
  }
}

/** Internal storage shape — adds connectionCount which clients never see. */
interface StoredParticipantState {
  participantId: string;
  displayName: string;
  role: ParticipantRole;
  type: ParticipantType;
  userId: string | null;
  micEnabled: boolean;
  cameraEnabled: boolean;
  connectionCount: number;
  joinedAt: string;
  lastSeenAt: string | null;
}
