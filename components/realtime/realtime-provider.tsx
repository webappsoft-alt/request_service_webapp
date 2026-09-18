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
import {
  connectRealtime,
  disconnectRealtime,
  getRealtimeSocket,
  joinChatThread,
  leaveChatThread,
  emitChatTyping,
  onRealtime,
  type RealtimeEvents,
} from "@/lib/realtime/socket";
import { readChatGuest } from "@/lib/booking/chat-store";
import { useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser, selectIsAuthenticated } from "@/store/authSlice";

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

function broadcastRealtime(detail: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REALTIME_EVENT, { detail }));
}

export function RealtimeProvider({ children }: PropsWithChildren) {
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const [connected, setConnected] = useState(false);
  const [lastChatThreadId, setLastChatThreadId] = useState<string | null>(null);
  const [lastNotificationAt, setLastNotificationAt] = useState(0);
  const [presenceMap, setPresenceMap] = useState<Record<string, UserPresence>>({});
  const activeThreadIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!auth.hydrated) return;

    const token = isAuthenticated ? auth.token : null;
    const guestEmail =
      !token && typeof window !== "undefined" ? readChatGuest()?.email || null : null;

    const socket = connectRealtime({ token, guestEmail });
    if (!socket) {
      setConnected(false);
      return;
    }

    const onConnect = () => {
      setConnected(true);
      if (activeThreadIdRef.current) {
        joinChatThread(activeThreadIdRef.current);
      }
    };
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
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

    const unsubscribers = [
      onRealtime("CHAT_MESSAGE", (payload) => {
        setLastChatThreadId(payload.threadId);
        // Only broadcast to the window event bus \u2014 do NOT dispatch rs-crm-api here.
        // Dispatching rs-crm-api on every message would trigger a full fetchThreads()
        // API call in every subscriber (provider, customer) on each incoming message.
        // Each view handles CHAT_MESSAGE in-place via subscribeRealtime().
        broadcastRealtime({ type: "CHAT_MESSAGE", payload });
      }),
      onRealtime("CHAT_THREAD_UPDATED", (payload) => {
        const id = typeof payload.id === "string" ? payload.id : null;
        if (id) setLastChatThreadId(id);
        // Broadcast inline update; views update thread metadata without a fetch.
        broadcastRealtime({ type: "CHAT_THREAD_UPDATED", payload });
      }),
      onRealtime("CHAT_TYPING", (payload) => {
        broadcastRealtime({ type: "CHAT_TYPING", payload });
      }),
      onRealtime("CHAT_READ_RECEIPT", (payload) => {
        broadcastRealtime({ type: "CHAT_READ_RECEIPT", payload });
        // NOTE: Never dispatch rs-crm-api here to prevent infinite ping-pong refetch loops!
      }),
      onRealtime("USER_PRESENCE", handlePresence),
      onRealtime("chat:presence", handlePresence),
      onRealtime("LEAD_CREATED", (payload) => {
        broadcastRealtime({ type: "LEAD_CREATED", payload });
        window.dispatchEvent(
          new CustomEvent("rs-realtime", { detail: { type: "INBOX_SUMMARY_INVALIDATE" } }),
        );
        toast.message("New quote request", {
          description: payload.number
            ? `${payload.number} just arrived in Leads.`
            : "A customer requested a quote.",
        });
      }),
      onRealtime("ESTIMATE_ACCEPTED", (payload) => {
        broadcastRealtime({ type: "ESTIMATE_ACCEPTED", payload });
        window.dispatchEvent(new Event("rs-crm-api"));
      }),
      onRealtime("INBOX_SUMMARY_INVALIDATE", (payload) => {
        // Only broadcast to the window bus. Do NOT dispatch rs-crm-api here —
        // INBOX_SUMMARY_INVALIDATE fires after every chat message send, so
        // dispatching rs-crm-api would trigger a full fetchThreads() on every send.
        broadcastRealtime({ type: "INBOX_SUMMARY_INVALIDATE", payload });
      }),
      onRealtime("NEW_NOTIFICATION", (payload: RealtimeEvents["NEW_NOTIFICATION"]) => {
        setLastNotificationAt(Date.now());
        broadcastRealtime({ type: "NEW_NOTIFICATION", payload });
        if (payload.title) {
          toast.message(payload.title, {
            description: payload.message || undefined,
          });
        }
      }),
      onRealtime("ORDER_UPDATED", (payload) => {
        broadcastRealtime({ type: "ORDER_UPDATED", payload });
        window.dispatchEvent(new Event("rs-crm-api"));
      }),
      onRealtime("LEAD_STATUS_UPDATED", (payload) => {
        const id = String(payload?.id || payload?.requestId || "").trim();
        const status = String(payload?.status || "").trim();
        if (!id || !status) return;
        broadcastRealtime({ type: "LEAD_STATUS_UPDATED", payload: { id, status, number: payload?.number } });
        window.dispatchEvent(new CustomEvent("rs-lead-status", { detail: { id, status } }));
        window.dispatchEvent(
          new CustomEvent("rs-realtime", { detail: { type: "INBOX_SUMMARY_INVALIDATE" } }),
        );
      }),
      onRealtime("REQUEST_STATUS_UPDATED", (payload) => {
        const id = String(payload?.id || payload?.requestId || "").trim();
        const status = String(payload?.status || "").trim();
        if (!id || !status) return;
        broadcastRealtime({ type: "REQUEST_STATUS_UPDATED", payload: { id, status, number: payload?.number } });
        window.dispatchEvent(new CustomEvent("rs-lead-status", { detail: { id, status } }));
        window.dispatchEvent(
          new CustomEvent("rs-realtime", { detail: { type: "INBOX_SUMMARY_INVALIDATE" } }),
        );
      }),
      onRealtime("LEAD_UPDATED", (payload: any) => {
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
      onRealtime("REQUEST_UPDATED", (payload: any) => {
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
      onRealtime("lead:status", (payload: any) => {
        const id = String(payload?.id || payload?.requestId || "").trim();
        const status = String(payload?.status || "").trim();
        if (!id || !status) return;
        broadcastRealtime({ type: "LEAD_STATUS_UPDATED", payload: { id, status } });
        window.dispatchEvent(new CustomEvent("rs-lead-status", { detail: { id, status } }));
        window.dispatchEvent(
          new CustomEvent("rs-realtime", { detail: { type: "INBOX_SUMMARY_INVALIDATE" } }),
        );
      }),
      onRealtime("request:status", (payload: any) => {
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
      socket.off("disconnect", onDisconnect);
      // Keep connection across route changes; only disconnect on auth change/unmount of root.
    };
  }, [auth.hydrated, auth.token, isAuthenticated, user?.id]);

  useEffect(() => {
    return () => {
      disconnectRealtime();
    };
  }, []);

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
    import("@/lib/realtime/socket").then((mod) => {
      mod.emitChatMarkRead(threadId);
    });
  }, []);

  const queryUserPresence = useCallback((userIds: string | string[]) => {
    import("@/lib/realtime/socket").then((mod) => {
      mod.queryPresence(userIds, (results) => {
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
      connected: connected || Boolean(getRealtimeSocket()?.connected),
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
      connected,
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
