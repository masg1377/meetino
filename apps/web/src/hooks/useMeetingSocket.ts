'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  ChatClientEvent,
  ChatServerEvent,
  ConnectionStatus,
  MAX_CHAT_BODY_LENGTH,
  MeetingClientEvent,
  MeetingServerEvent,
  type ChatErrorPayload,
  type ChatHistoryResponse,
  type ChatMessageDto,
  type ChatMessagePayload,
  type ChatSendPayload,
  type MeetingEndedPayload,
  type MeetingErrorPayload,
  type MeetingLockedPayload,
  type MeetingUnlockedPayload,
  type ParticipantJoinedPayload,
  type ParticipantKickedPayload,
  type ParticipantLeftPayload,
  type ParticipantRejoinApprovedPayload,
  type ParticipantRejoinRejectedPayload,
  type ParticipantRejoinRequestedPayload,
  type ParticipantState,
  type ParticipantStateUpdatedPayload,
  type ParticipantsUpdatedPayload,
} from '@meetino/shared';
import { apiClient, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { getSocketUrl, SOCKET_NAMESPACE } from '@/lib/socket';

/**
 * What the room page gets back from the hook. `participants` is keyed by
 * participantId; `me` is the live state of the local user once joined.
 */
export interface MeetingRealtime {
  status: ConnectionStatus;
  participants: ParticipantState[];
  /** The local participant once joined; null until first roster broadcast. */
  me: ParticipantState | null;
  error: MeetingErrorPayload | null;
  toggleMic: (enabled: boolean) => void;
  toggleCamera: (enabled: boolean) => void;
  leave: () => void;

  // ── Chat (Phase 5) ────────────────────────────────────────────
  /** Persisted history + realtime messages, chronological. */
  messages: ChatMessageDto[];
  /** True while the initial GET /chat is in flight. */
  isHistoryLoading: boolean;
  /** Most recent chat-specific error (validation, send failures). */
  chatError: ChatErrorPayload | null;
  /** Returns true if the send was issued, false if pre-flight failed. */
  sendChat: (body: string) => boolean;
  /** Clear any chat error (e.g. after the user fixes their input). */
  clearChatError: () => void;

  // ── Security (Phase 7) ───────────────────────────────────────
  /** Mirrors the live `meeting.isLocked` flag via WS broadcasts. */
  isLocked: boolean;
  /** True once the host has ended the meeting for everyone. */
  isEnded: boolean;
  /** Set when *I* am the participant who got kicked. */
  wasKicked: boolean;
  /** Display name of someone else just kicked — for a toast (cleared by clearKickNotice). */
  lastKickedOther: { participantId: string; displayName: string } | null;
  clearKickNotice: () => void;

  // ── Whiteboard / file sharing (Phase 7.7) ───────────────────────
  /**
   * Raw socket reference for callers that need to subscribe to events
   * outside this hook's vocabulary (whiteboard ops, file-shared, etc.).
   * Stable across renders — only changes when the meeting slug changes.
   * Null while connecting or when no slug is active.
   */
  socket: Socket | null;

  // ── Rejoin approval (Phase 7.6) ─────────────────────────────────
  /**
   * Host-side: pending rejoin requests (most recent first). Cleared per
   * request when the host approves / rejects, or on its REJOIN_APPROVED /
   * REJOIN_REJECTED echo.
   */
  rejoinRequests: ParticipantRejoinRequestedPayload[];
  /** Dismiss a pending request from the local list (e.g. after acting on it). */
  dismissRejoinRequest: (requestId: string) => void;
  /**
   * Kicked-user-side: set when the host approves my pending rejoin so the
   * UI can pop a "you're back in" notice. Null until we receive an event.
   */
  myRejoinDecision: 'APPROVED' | 'REJECTED' | null;
  clearMyRejoinDecision: () => void;
}

/**
 * useMeetingSocket(slug, participantId)
 *
 * Opens the gateway connection for the given slug. The access token is read
 * from the in-memory auth store; the guest cookie travels automatically via
 * `withCredentials`. We always send BOTH if present — the server decides
 * which path to honour.
 *
 * Idempotency:
 *  - Effect runs once per slug; React Strict Mode double-invocation is
 *    handled by the explicit `disconnect()` in the cleanup.
 *  - `participantId` is used to locate `me` in the participants list.
 */
export function useMeetingSocket(
  slug: string | null,
  participantId: string | null,
): MeetingRealtime {
  const [status, setStatus] = useState<ConnectionStatus>(
    ConnectionStatus.CONNECTING,
  );
  const [participants, setParticipants] = useState<ParticipantState[]>([]);
  const [error, setError] = useState<MeetingErrorPayload | null>(null);

  // Chat state (Phase 5)
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(true);
  const [chatError, setChatError] = useState<ChatErrorPayload | null>(null);

  // Security state (Phase 7)
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isEnded, setIsEnded] = useState<boolean>(false);
  const [wasKicked, setWasKicked] = useState<boolean>(false);
  const [lastKickedOther, setLastKickedOther] = useState<{
    participantId: string;
    displayName: string;
  } | null>(null);

  // Rejoin workflow (Phase 7.6)
  const [rejoinRequests, setRejoinRequests] = useState<
    ParticipantRejoinRequestedPayload[]
  >([]);
  const [myRejoinDecision, setMyRejoinDecision] = useState<
    'APPROVED' | 'REJECTED' | null
  >(null);

  // We hold the socket in a ref so callbacks can emit without re-renders.
  const socketRef = useRef<Socket | null>(null);
  // participantId can change identity (e.g. guest re-joins) — keep latest in a ref
  // so the WS event listeners always see it.
  const meIdRef = useRef<string | null>(participantId);
  meIdRef.current = participantId;

  useEffect(() => {
    if (!slug) return;
    setStatus(ConnectionStatus.CONNECTING);
    setError(null);

    // Read the latest access token at connect time. Reconnecting on every
    // 15-minute rotation would be wasteful; the gateway only verifies the
    // bearer once at handshake and trusts the participant snapshot afterwards.
    const accessToken = useAuthStore.getState().accessToken;

    const socket = io(`${getSocketUrl()}${SOCKET_NAMESPACE}`, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 800,
      reconnectionDelayMax: 4_000,
      auth: {
        slug,
        // Falsy bearer makes the server fall back to the guest-cookie path.
        token: accessToken ?? undefined,
      },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus(ConnectionStatus.CONNECTED);
      socket.emit(MeetingClientEvent.JOIN);
    });

    socket.on('connect_error', (err) => {
      setStatus(ConnectionStatus.ERROR);
      setError({ code: 'INTERNAL', message: err.message || 'اتصال برقرار نشد' });
    });

    socket.on('disconnect', (reason) => {
      // 'io client disconnect' fires on our own leave() — not an error state.
      if (reason === 'io client disconnect') {
        setStatus(ConnectionStatus.DISCONNECTED);
        return;
      }
      setStatus(ConnectionStatus.DISCONNECTED);
    });

    socket.on(MeetingServerEvent.PARTICIPANTS_UPDATED, (p: ParticipantsUpdatedPayload) => {
      setParticipants(p.participants);
    });

    socket.on(MeetingServerEvent.PARTICIPANT_JOINED, (p: ParticipantJoinedPayload) => {
      setParticipants((prev) => {
        // De-dupe by id; new entry wins on collision.
        const filtered = prev.filter((x) => x.participantId !== p.participant.participantId);
        return [...filtered, p.participant];
      });
    });

    socket.on(MeetingServerEvent.PARTICIPANT_LEFT, (p: ParticipantLeftPayload) => {
      setParticipants((prev) => prev.filter((x) => x.participantId !== p.participantId));
    });

    socket.on(MeetingServerEvent.STATE_UPDATED, (p: ParticipantStateUpdatedPayload) => {
      setParticipants((prev) =>
        prev.map((x) =>
          x.participantId === p.participantId ? { ...x, ...p.patch } : x,
        ),
      );
    });

    socket.on(MeetingServerEvent.ERROR, (e: MeetingErrorPayload) => {
      setError(e);
    });

    // ── Chat events ─────────────────────────────────────────────
    socket.on(ChatServerEvent.MESSAGE, (p: ChatMessagePayload) => {
      // De-dupe: a reconnect can replay history; never list the same id twice.
      setMessages((prev) => {
        if (prev.some((m) => m.id === p.message.id)) return prev;
        return [...prev, p.message];
      });
    });

    socket.on(ChatServerEvent.ERROR, (e: ChatErrorPayload) => {
      setChatError(e);
    });

    // ── Security broadcasts (Phase 7) ────────────────────────────
    socket.on(MeetingServerEvent.LOCKED, (_p: MeetingLockedPayload) => {
      setIsLocked(true);
    });
    socket.on(MeetingServerEvent.UNLOCKED, (_p: MeetingUnlockedPayload) => {
      setIsLocked(false);
    });
    socket.on(MeetingServerEvent.ENDED, (_p: MeetingEndedPayload) => {
      setIsEnded(true);
    });
    socket.on(MeetingServerEvent.PARTICIPANT_KICKED, (p: ParticipantKickedPayload) => {
      if (p.participantId === meIdRef.current) {
        // I am the kicked one. Set the local flag — the room page reads this
        // and tears down LiveKit. The server has already disconnected our socket.
        setWasKicked(true);
      } else {
        // Someone else got kicked — drop them from the roster + remember for toast.
        setParticipants((prev) => prev.filter((x) => x.participantId !== p.participantId));
        setLastKickedOther({ participantId: p.participantId, displayName: p.displayName });
      }
    });

    // ── Rejoin workflow (Phase 7.6) ──────────────────────────────
    socket.on(
      MeetingServerEvent.REJOIN_REQUESTED,
      (p: ParticipantRejoinRequestedPayload) => {
        // Coalesce same-participant repeats into a single banner so a noisy
        // kicked user can't spam the host UI.
        setRejoinRequests((prev) => {
          const without = prev.filter((x) => x.participantId !== p.participantId);
          return [p, ...without];
        });
      },
    );
    socket.on(
      MeetingServerEvent.REJOIN_APPROVED,
      (p: ParticipantRejoinApprovedPayload) => {
        // Host UIs: clear the matching prompt. Kicked user: surface "approved".
        setRejoinRequests((prev) => prev.filter((x) => x.requestId !== p.requestId));
        if (p.participantId === meIdRef.current) {
          setMyRejoinDecision('APPROVED');
          // Clear the local kicked flag so the room page can re-render.
          setWasKicked(false);
        }
      },
    );
    socket.on(
      MeetingServerEvent.REJOIN_REJECTED,
      (p: ParticipantRejoinRejectedPayload) => {
        setRejoinRequests((prev) => prev.filter((x) => x.requestId !== p.requestId));
        if (p.participantId === meIdRef.current) {
          setMyRejoinDecision('REJECTED');
        }
      },
    );

    return () => {
      // Tell the server we're leaving before tearing down the socket so the
      // room sees the patch immediately rather than waiting for ping timeout.
      try {
        if (socket.connected) socket.emit(MeetingClientEvent.LEAVE);
      } catch {
        // socket is already closed
      }
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [slug]);

  // ── Chat history fetch (one-shot per slug) ────────────────────

  useEffect(() => {
    if (!slug) {
      setMessages([]);
      setIsHistoryLoading(false);
      return;
    }
    let cancelled = false;
    setIsHistoryLoading(true);
    (async () => {
      try {
        const data = await apiClient.get<ChatHistoryResponse>(
          `/meetings/${slug}/chat`,
        );
        if (!cancelled) setMessages(data.messages);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof ApiError ? err.message : 'بارگذاری تاریخچهٔ چت با خطا مواجه شد.';
        setChatError({ code: 'INTERNAL', message });
      } finally {
        if (!cancelled) setIsHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // ── Emitters ────────────────────────────────────────────────────

  const toggleMic = useCallback((enabled: boolean) => {
    const s = socketRef.current;
    if (!s?.connected) return;
    s.emit(MeetingClientEvent.MIC_TOGGLE, { enabled });
  }, []);

  const toggleCamera = useCallback((enabled: boolean) => {
    const s = socketRef.current;
    if (!s?.connected) return;
    s.emit(MeetingClientEvent.CAMERA_TOGGLE, { enabled });
  }, []);

  const leave = useCallback(() => {
    const s = socketRef.current;
    if (!s) return;
    if (s.connected) s.emit(MeetingClientEvent.LEAVE);
    s.disconnect();
  }, []);

  const sendChat = useCallback((rawBody: string): boolean => {
    const s = socketRef.current;
    const body = rawBody.trim();
    if (body.length === 0) {
      setChatError({ code: 'INVALID_PAYLOAD', message: 'پیام نمی‌تواند خالی باشد.' });
      return false;
    }
    if (body.length > MAX_CHAT_BODY_LENGTH) {
      setChatError({
        code: 'INVALID_PAYLOAD',
        message: `پیام نباید بیشتر از ${MAX_CHAT_BODY_LENGTH} کاراکتر باشد.`,
      });
      return false;
    }
    if (!s?.connected) {
      setChatError({ code: 'INTERNAL', message: 'اتصال برقرار نیست.' });
      return false;
    }
    const payload: ChatSendPayload = { body };
    s.emit(ChatClientEvent.SEND, payload);
    setChatError(null);
    return true;
  }, []);

  const clearChatError = useCallback(() => setChatError(null), []);
  const clearKickNotice = useCallback(() => setLastKickedOther(null), []);
  const dismissRejoinRequest = useCallback((requestId: string) => {
    setRejoinRequests((prev) => prev.filter((x) => x.requestId !== requestId));
  }, []);
  const clearMyRejoinDecision = useCallback(() => setMyRejoinDecision(null), []);

  const me = useMemo<ParticipantState | null>(() => {
    if (!participantId) return null;
    return participants.find((p) => p.participantId === participantId) ?? null;
  }, [participants, participantId]);

  return {
    status,
    participants,
    me,
    error,
    toggleMic,
    toggleCamera,
    leave,
    messages,
    isHistoryLoading,
    chatError,
    sendChat,
    clearChatError,
    isLocked,
    isEnded,
    wasKicked,
    lastKickedOther,
    clearKickNotice,
    rejoinRequests,
    dismissRejoinRequest,
    myRejoinDecision,
    clearMyRejoinDecision,
    socket: socketRef.current,
  };
}
