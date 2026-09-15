"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

type RealtimeContextValue = {
  connected: boolean;
  joinThread: (threadId: string) => void;
  leaveThread: (threadId: string) => void;
  setTyping: (threadId: string, isTyping: boolean) => void;
  lastChatThreadId: string | null;
  lastNotificationAt: number;
};

const RealtimeContext = createContext<RealtimeContextValue>({
  connected: false,
  joinThread: () => {},
  leaveThread: () => {},
  setTyping: () => {},
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

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    if (socket.connected) setConnected(true);

    const unsubscribers = [
      onRealtime("CHAT_MESSAGE", (payload) => {
        setLastChatThreadId(payload.threadId);
        broadcastRealtime({ type: "CHAT_MESSAGE", payload });
        window.dispatchEvent(new Event("rs-crm-api"));
      }),
      onRealtime("CHAT_THREAD_UPDATED", (payload) => {
        const id = typeof payload.id === "string" ? payload.id : null;
        if (id) setLastChatThreadId(id);
        broadcastRealtime({ type: "CHAT_THREAD_UPDATED", payload });
        window.dispatchEvent(new Event("rs-crm-api"));
      }),
      onRealtime("LEAD_CREATED", (payload) => {
        broadcastRealtime({ type: "LEAD_CREATED", payload });
        window.dispatchEvent(new Event("rs-crm-api"));
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
        broadcastRealtime({ type: "INBOX_SUMMARY_INVALIDATE", payload });
        window.dispatchEvent(new Event("rs-crm-api"));
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
    joinChatThread(threadId);
  }, []);

  const leaveThread = useCallback((threadId: string) => {
    leaveChatThread(threadId);
  }, []);

  const setTyping = useCallback((threadId: string, isTyping: boolean) => {
    emitChatTyping(threadId, isTyping);
  }, []);

  const value = useMemo(
    () => ({
      connected: connected || Boolean(getRealtimeSocket()?.connected),
      joinThread,
      leaveThread,
      setTyping,
      lastChatThreadId,
      lastNotificationAt,
    }),
    [
      connected,
      joinThread,
      leaveThread,
      setTyping,
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
