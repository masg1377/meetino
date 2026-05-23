import { Injectable, Logger } from '@nestjs/common';
import type { WhiteboardOp, WhiteboardSnapshotPayload } from '@meetino/shared';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Phase 7.7 — whiteboard persistence.
 *
 * One row per meeting holds the latest *snapshot* (a JSON array of
 * `WhiteboardOp`). The realtime stream of individual ops is NOT recorded
 * to keep DB write rate sane. Instead we coalesce: every ~750ms or every
 * 32 incoming ops (whichever comes first), the gateway calls
 * `MeetingWhiteboardService.persist(meetingId, ops)` which upserts the
 * row with the merged op list.
 *
 * Late-joiners ask for the snapshot once they connect; the service hands
 * back the persisted op array. Joiners then receive subsequent ops over
 * the realtime stream.
 *
 * Concurrency: the table key is meetingId, so writes from concurrent
 * persists serialize at the row level. Revision is bumped each upsert.
 */
@Injectable()
export class MeetingWhiteboardService {
  private readonly logger = new Logger(MeetingWhiteboardService.name);

  /** In-memory op buffer per meetingId. Flushed by `persist`. */
  private readonly buffers = new Map<string, WhiteboardOp[]>();
  /** Pending flush timer per meetingId. */
  private readonly flushTimers = new Map<string, NodeJS.Timeout>();
  /** Max ops before forcing a flush, regardless of timer. */
  private static readonly MAX_BUFFER = 32;
  /** Max ops kept in the persisted snapshot. Old ops are dropped FIFO. */
  private static readonly MAX_SNAPSHOT_OPS = 2_000;
  /** Debounce window between flushes per meeting. */
  private static readonly FLUSH_MS = 750;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Queue an op for persistence. Caller has already broadcast it; we just
   * need to make sure late-joiners see it.
   */
  recordOp(meetingId: string, op: WhiteboardOp): void {
    const buf = this.buffers.get(meetingId) ?? [];
    buf.push(op);
    this.buffers.set(meetingId, buf);

    if (buf.length >= MeetingWhiteboardService.MAX_BUFFER) {
      void this.flush(meetingId);
      return;
    }
    if (!this.flushTimers.has(meetingId)) {
      const timer = setTimeout(() => {
        this.flushTimers.delete(meetingId);
        void this.flush(meetingId);
      }, MeetingWhiteboardService.FLUSH_MS);
      this.flushTimers.set(meetingId, timer);
    }
  }

  /**
   * Drop everything for a meeting (board clear). The buffered ops are
   * discarded and the row is reset to an empty snapshot.
   */
  async clear(meetingId: string): Promise<void> {
    this.buffers.delete(meetingId);
    const timer = this.flushTimers.get(meetingId);
    if (timer) {
      clearTimeout(timer);
      this.flushTimers.delete(meetingId);
    }
    try {
      await this.prisma.whiteboardSnapshot.upsert({
        where: { meetingId },
        update: { data: [], revision: { increment: 1 } },
        create: { meetingId, data: [], revision: 1 },
      });
    } catch (err) {
      this.logger.warn(`whiteboard clear failed for ${meetingId}: ${(err as Error).message}`);
    }
  }

  /** Return the latest snapshot for a meeting (or an empty one if none). */
  async getSnapshot(meetingId: string): Promise<WhiteboardSnapshotPayload> {
    try {
      // If anything's still buffered, flush before reading so the snapshot
      // is fully up to date.
      await this.flush(meetingId);
      const row = await this.prisma.whiteboardSnapshot.findUnique({
        where: { meetingId },
      });
      if (!row) return { revision: 0, ops: [] };
      const ops = Array.isArray(row.data) ? (row.data as unknown as WhiteboardOp[]) : [];
      return { revision: row.revision, ops };
    } catch (err) {
      this.logger.warn(`whiteboard getSnapshot failed for ${meetingId}: ${(err as Error).message}`);
      return { revision: 0, ops: [] };
    }
  }

  /** Force-flush the in-memory buffer for a meeting to Postgres. */
  private async flush(meetingId: string): Promise<void> {
    const pending = this.buffers.get(meetingId);
    if (!pending || pending.length === 0) return;
    this.buffers.set(meetingId, []);

    try {
      const existing = await this.prisma.whiteboardSnapshot.findUnique({
        where: { meetingId },
        select: { data: true, revision: true },
      });
      const prev = Array.isArray(existing?.data) ? (existing!.data as unknown as WhiteboardOp[]) : [];
      const merged = [...prev, ...pending];
      const trimmed =
        merged.length > MeetingWhiteboardService.MAX_SNAPSHOT_OPS
          ? merged.slice(-MeetingWhiteboardService.MAX_SNAPSHOT_OPS)
          : merged;

      await this.prisma.whiteboardSnapshot.upsert({
        where: { meetingId },
        update: {
          data: trimmed as unknown as object,
          revision: (existing?.revision ?? 0) + 1,
        },
        create: {
          meetingId,
          data: trimmed as unknown as object,
          revision: 1,
        },
      });
    } catch (err) {
      // Push the dropped ops back so the next flush can retry.
      const buf = this.buffers.get(meetingId) ?? [];
      this.buffers.set(meetingId, [...pending, ...buf]);
      this.logger.warn(
        `whiteboard flush failed for ${meetingId}: ${(err as Error).message}`,
      );
    }
  }
}
