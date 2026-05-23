/**
 * Chat contract — shared by the REST history endpoint and the WS gateway.
 *
 * Messages carry a *snapshot* of the sender's identity (display name, role,
 * type). That snapshot is set on the server when the message is saved and is
 * never trusted from the client. If the sender's participant row is later
 * deleted (e.g. the meeting is wiped), the message remains readable with
 * `participantId = null`.
 */
import type { ParticipantRole, ParticipantType } from '../enums';
import type { RealtimeErrorCode } from './realtime';

// ── DTO ──────────────────────────────────────────────────────────────

export interface ChatMessageDto {
  id: string;
  meetingId: string;
  /** Null when the original participant row has been deleted. */
  participantId: string | null;
  senderDisplayName: string;
  senderRole: ParticipantRole;
  senderType: ParticipantType;
  body: string;
  /** ISO timestamp. */
  createdAt: string;
}

// ── REST ─────────────────────────────────────────────────────────────

/** Response of GET /api/meetings/:slug/chat — chronological (oldest first). */
export interface ChatHistoryResponse {
  messages: ChatMessageDto[];
}

// ── WS event names (kept in lock-step with the server) ───────────────

export const ChatClientEvent = {
  SEND: 'chat:send',
} as const;
export type ChatClientEvent =
  (typeof ChatClientEvent)[keyof typeof ChatClientEvent];

export const ChatServerEvent = {
  MESSAGE: 'chat:message',
  ERROR: 'chat:error',
} as const;
export type ChatServerEvent =
  (typeof ChatServerEvent)[keyof typeof ChatServerEvent];

// ── WS payloads ──────────────────────────────────────────────────────

/** Body must be a non-empty trimmed string ≤ MAX_CHAT_BODY_LENGTH chars. */
export interface ChatSendPayload {
  body: string;
}

export interface ChatMessagePayload {
  message: ChatMessageDto;
}

export interface ChatErrorPayload {
  code: RealtimeErrorCode;
  message: string;
}

// ── Tunables (used by both sides for validation parity) ──────────────

/**
 * Max characters of a single chat message. Kept modest to avoid abuse and
 * to keep the Redis/event payloads small. We enforce on BOTH ends, but the
 * server is the source of truth.
 */
export const MAX_CHAT_BODY_LENGTH = 2000;
