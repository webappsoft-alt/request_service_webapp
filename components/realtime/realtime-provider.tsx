"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { toast } from "sonner";
import { useSocket } from "@/components/socket/SocketProvider";
import {
  joinChatThread,
  leaveChatThread,
  emitChatTyping,
  emitChatMarkRead,
  onSocketEvent,
  queryPresence,
  type RealtimeEvents,
} from "@/components/socket";
import { normalizeSocketNotification } from "@/lib/api/notifications-client";

export type UserPresence = {
  isOnline: boolean;
  lastSeen?: string;
  lastActiveAt?: string;
};

type RealtimeContextValue = {
  connected: boolean;
  joinThread: (threadId: string) => void;
  leaveThread: (threadId: string) => void;
  setTyping: (threadId: string, isTyping: boolean) => void;
  markThreadRead: (threadId: string) => void;
  queryUserPresence: (userIds: string | string[]) => void;
  getPresence: (userId?: string | null) => UserPresence | undefined;
  presenceMap: Record<string, UserPresence>;
  lastChatThreadId: string | null;
  lastNotificationAt: number;
};

const RealtimeContext = createContext<RealtimeContextValue>({
  connected: false,
  joinThread: () => {},
  leaveThread: () => {},
  setTyping: () => {},
  markThreadRead: () => {},
  queryUserPresence: () => {},
  getPresence: () => undefined,
  presenceMap: {},
  lastChatThreadId: null,
  lastNotificationAt: 0,
});

const REALTIME_EVENT = "rs-realtime";

/** Prevent stacked identical toasts (dual listeners / HMR orphans). */
const recentToastKeys = new Map<string, number>();
const TOAST_DEDUPE_MS = 4000;

function showNotificationToast(title: string, message?: string) {
  // Dedupe on content only — ignore notification id (two DB rows must not double-toast).
  const key = `${title.trim()}::${String(message || "").trim()}`.toLowerCase();
  const now = Date.now();
  const last = recentToastKeys.get(key) || 0;
  if (now - last < TOAST_DEDUPE_MS) return;
  recentToastKeys.set(key, now);
  for (const [k, at] of recentToastKeys) {
    if (now - at > TOAST_DEDUPE_MS * 4) recentToastKeys.delete(k);
  }
  toast.message(title, {
    id: `notif:${key}`,
    description: message || undefined,
  });
}

function broadcastRealtime(detail: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REALTIME_EVENT, { detail }));
}

export function RealtimeProvider({ children }: PropsWithChildren) {
  const { socket, isConnected } = useSocket();
  const [lastChatThreadId, setLastChatThreadId] = useState<string | null>(null);
  const [lastNotificationAt, setLastNotificationAt] = useState(0);
  const [presenceMap, setPresenceMap] = useState<Record<string, UserPresence>>({});
  const activeThreadIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    // Clear orphaned NEW_NOTIFICATION handlers (HMR / failed prior cleanups).
    socket.removeAllListeners("NEW_NOTIFICATION");

    const onConnect = () => {
      if (activeThreadIdRef.current) {
        joinChatThread(activeThreadIdRef.current);
      }
    };

    socket.on("connect", onConnect);
    if (socket.connected) onConnect();

    const handlePresence = (payload: {
      userId?: string | null;
      guestEmail?: string | null;
      isOnline: boolean;
      lastSeen?: string;
      lastActiveAt?: string;
    }) => {
      const key = payload?.userId || payload?.guestEmail?.toLowerCase();
      if (!key) return;
      setPresenceMap((prev) => ({
        ...prev,
        [key]: {
          isOnline: Boolean(payload.isOnline),
          lastSeen: payload.lastSeen,
          lastActiveAt: payload.lastActiveAt,
        },
      }));
      broadcastRealtime({ type: "USER_PRESENCE", payload });
    };

    const onNewNotification = (raw: unknown) => {
      const normalized = normalizeSocketNotification(raw);
      const payload = {
        ...(typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {}),
        ...(normalized
          ? {
              id: normalized.id,
              title: normalized.title,
              message: normalized.message,
              type: normalized.type,
              data: normalized.data,
            }
          : {}),
      } as RealtimeEvents["NEW_NOTIFICATION"];
      setLastNotificationAt(Date.now());
      broadcastRealtime({ type: "NEW_NOTIFICATION", payload });
      broadcastRealtime({ type: "CUSTOMER_BADGE_INVALIDATE", payload });
      if (payload.title) {
        showNotificationToast(payload.title, payload.message || undefined);
      }
    };

    socket.on("NEW_NOTIFICATION", onNewNotification);

    const unsubscribers = [
      onSocketEvent("CHAT_MESSAGE", (payload) => {
        setLastChatThreadId(payload.threadId);
        broadcastRealtime({ type: "CHAT_MESSAGE", payload });
      }),
      onSocketEvent("CHAT_THREAD_UPDATED", (payload) => {
        const id = typeof payload.id === "string" ? payload.id : null;
        if (id) setLastChatThreadId(id);
        broadcastRealtime({ type: "CHAT_THREAD_UPDATED", payload });
      }),
      onSocketEvent("CHAT_TYPING", (payload) => {
        broadcastRealtime({ type: "CHAT_TYPING", payload });
      }),
      onSocketEvent("CHAT_READ_RECEIPT", (payload) => {
        broadcastRealtime({ type: "CHAT_READ_RECEIPT", payload });
      }),
      onSocketEvent("USER_PRESENCE", handlePresence),
      onSocketEvent("chat:presence", handlePresence),
      onSocketEvent("LEAD_CREATED", (payload) => {
        broadcastRealtime({ type: "LEAD_CREATED", payload });
        window.dispatchEvent(
          new CustomEvent("rs-realtime", { detail: { type: "INBOX_SUMMARY_INVALIDATE" } }),
        );
        showNotificationToast(
          "New quote request",
          payload.number
            ? `${payload.number} just arrived in Leads.`
            : "A customer requested a quote.",
        );
      }),
      onSocketEvent("ESTIMATE_ACCEPTED", (payload) => {
        broadcastRealtime({ type: "ESTIMATE_ACCEPTED", payload });
        window.dispatchEvent(new Event("rs-crm-api"));
        window.dispatchEvent(
          new CustomEvent("rs-realtime", { detail: { type: "INBOX_SUMMARY_INVALIDATE" } }),
        );
      }),
      onSocketEvent("ESTIMATE_UPDATED", (payload) => {
        broadcastRealtime({ type: "ESTIMATE_UPDATED", payload });
        window.dispatchEvent(new Event("rs-crm-api"));
        window.dispatchEvent(
          new CustomEvent("rs-realtime", { detail: { type: "INBOX_SUMMARY_INVALIDATE" } }),
        );
      }),
      onSocketEvent("ESTIMATE_SENT", (payload) => {
        broadcastRealtime({ type: "ESTIMATE_SENT", payload });
        broadcastRealtime({ type: "CUSTOMER_BADGE_INVALIDATE", payload });
      }),
      onSocketEvent("INVOICE_SENT", (payload) => {
        broadcastRealtime({ type: "INVOICE_SENT", payload });
        broadcastRealtime({ type: "CUSTOMER_BADGE_INVALIDATE", payload });
      }),
      onSocketEvent("CUSTOMER_BADGE_INVALIDATE", (payload) => {
        broadcastRealtime({ type: "CUSTOMER_BADGE_INVALIDATE", payload });
      }),
      onSocketEvent("INBOX_SUMMARY_INVALIDATE", (payload) => {
        broadcastRealtime({ type: "INBOX_SUMMARY_INVALIDATE", payload });
      }),
      onSocketEvent("ORDER_UPDATED", (payload) => {
        broadcastRealtime({ type: "ORDER_UPDATED", payload });
        window.dispatchEvent(new Event("rs-crm-api"));
      }),
      onSocketEvent("LEAD_STATUS_UPDATED", (payload) => {
        const id = String(payload?.id || payload?.requestId || "").trim();
        const status = String(payload?.status || "").trim();
        if (!id || !status) return;
        broadcastRealtime({ type: "LEAD_STATUS_UPDATED", payload: { id, status, number: payload?.number } });
        window.dispatchEvent(new CustomEvent("rs-lead-status", { detail: { id, status } }));
        window.dispatchEvent(
          new CustomEvent("rs-realtime", { detail: { type: "INBOX_SUMMARY_INVALIDATE" } }),
        );
      }),
      onSocketEvent("REQUEST_STATUS_UPDATED", (payload) => {
        const id = String(payload?.id || payload?.requestId || "").trim();
        const status = String(payload?.status || "").trim();
        if (!id || !status) return;
        broadcastRealtime({ type: "REQUEST_STATUS_UPDATED", payload: { id, status, number: payload?.number } });
        window.dispatchEvent(new CustomEvent("rs-lead-status", { detail: { id, status } }));
        window.dispatchEvent(
          new CustomEvent("rs-realtime", { detail: { type: "INBOX_SUMMARY_INVALIDATE" } }),
        );
      }),
      onSocketEvent("LEAD_UPDATED", (payload: any) => {
        const id = String(payload?.id || payload?._id || "").trim();
        const status = String(payload?.status || "").trim();
        if (id && status) {
          broadcastRealtime({ type: "LEAD_STATUS_UPDATED", payload: { id, status } });
          window.dispatchEvent(new CustomEvent("rs-lead-status", { detail: { id, status } }));
          window.dispatchEvent(
            new CustomEvent("rs-realtime", { detail: { type: "INBOX_SUMMARY_INVALIDATE" } }),
          );
        } else {
          broadcastRealtime({ type: "LEAD_UPDATED", payload });
        }
      }),
      onSocketEvent("REQUEST_UPDATED", (payload: any) => {
        const id = String(payload?.id || payload?._id || "").trim();
        const status = String(payload?.status || "").trim();
        if (id && status) {
          broadcastRealtime({ type: "REQUEST_STATUS_UPDATED", payload: { id, status } });
          window.dispatchEvent(new CustomEvent("rs-lead-status", { detail: { id, status } }));
          window.dispatchEvent(
            new CustomEvent("rs-realtime", { detail: { type: "INBOX_SUMMARY_INVALIDATE" } }),
          );
        } else {
          broadcastRealtime({ type: "REQUEST_UPDATED", payload });
        }
      }),
      onSocketEvent("lead:status", (payload: any) => {
        const id = String(payload?.id || payload?.requestId || "").trim();
        const status = String(payload?.status || "").trim();
        if (!id || !status) return;
        broadcastRealtime({ type: "LEAD_STATUS_UPDATED", payload: { id, status } });
        window.dispatchEvent(new CustomEvent("rs-lead-status", { detail: { id, status } }));
        window.dispatchEvent(
          new CustomEvent("rs-realtime", { detail: { type: "INBOX_SUMMARY_INVALIDATE" } }),
        );
      }),
      onSocketEvent("request:status", (payload: any) => {
        const id = String(payload?.id || payload?.requestId || "").trim();
        const status = String(payload?.status || "").trim();
        if (!id || !status) return;
        broadcastRealtime({ type: "REQUEST_STATUS_UPDATED", payload: { id, status } });
        window.dispatchEvent(new CustomEvent("rs-lead-status", { detail: { id, status } }));
        window.dispatchEvent(
          new CustomEvent("rs-realtime", { detail: { type: "INBOX_SUMMARY_INVALIDATE" } }),
        );
      }),
    ];

    return () => {
      unsubscribers.forEach((off) => off());
      socket.off("connect", onConnect);
      socket.off("NEW_NOTIFICATION", onNewNotification);
      socket.removeAllListeners("NEW_NOTIFICATION");
    };
  }, [socket]);

  const joinThread = useCallback((threadId: string) => {
    activeThreadIdRef.current = threadId;
    joinChatThread(threadId);
  }, []);

  const leaveThread = useCallback((threadId: string) => {
    if (activeThreadIdRef.current === threadId) {
      activeThreadIdRef.current = null;
    }
    leaveChatThread(threadId);
  }, []);

  const setTyping = useCallback((threadId: string, isTyping: boolean) => {
    emitChatTyping(threadId, isTyping);
  }, []);

  const markThreadRead = useCallback((threadId: string) => {
    emitChatMarkRead(threadId);
  }, []);

  const queryUserPresence = useCallback((userIds: string | string[]) => {
    queryPresence(userIds, (results) => {
      if (!results?.length) return;
      setPresenceMap((prev) => {
        const next = { ...prev };
        for (const item of results) {
          if (item.userId) {
            next[item.userId] = {
              isOnline: Boolean(item.isOnline),
              lastSeen: item.lastSeen,
              lastActiveAt: item.lastActiveAt,
            };
          }
        }
        return next;
      });
    });
  }, []);

  const getPresence = useCallback(
    (userId?: string | null) => {
      if (!userId) return undefined;
      return presenceMap[userId] || presenceMap[userId.toLowerCase()];
    },
    [presenceMap],
  );

  const value = useMemo(
    () => ({
      connected: isConnected || Boolean(socket?.connected),
      joinThread,
      leaveThread,
      setTyping,
      markThreadRead,
      queryUserPresence,
      getPresence,
      presenceMap,
      lastChatThreadId,
      lastNotificationAt,
    }),
    [
      isConnected,
      socket,
      joinThread,
      leaveThread,
      setTyping,
      markThreadRead,
      queryUserPresence,
      getPresence,
      presenceMap,
      lastChatThreadId,
      lastNotificationAt,
    ],
  );

  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}

export function subscribeRealtime(onChange: (detail: Record<string, unknown>) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const custom = event as CustomEvent<Record<string, unknown>>;
    onChange(custom.detail || {});
  };
  window.addEventListener(REALTIME_EVENT, handler);
  return () => window.removeEventListener(REALTIME_EVENT, handler);
}
