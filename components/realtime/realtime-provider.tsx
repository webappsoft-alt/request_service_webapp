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
import { useAppSelector } from "@/store/hooks";
import { selectAuthUser } from "@/store/authSlice";

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
  /** Platform Support (any admin) online for admin-direct chats */
  supportOnline: boolean;
  /** Currently joined/active thread id (incl. admin-direct) */
  activeThreadId: string | null;
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
  supportOnline: false,
  activeThreadId: null,
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
  // Also collapse lead/booking duplicates that share a request/order number in the body.
  const reqMatch = String(message || "").match(/\b(REQ-\d+|RFQ-\d+|ORD-[\w-]+)\b/i);
  if (reqMatch) {
    const leadKey = `lead:${reqMatch[1].toUpperCase()}`;
    const leadLast = recentToastKeys.get(leadKey) || 0;
    if (now - leadLast < TOAST_DEDUPE_MS) return;
    recentToastKeys.set(leadKey, now);
  }
  toast.message(title, {
    id: `notif:${key}`,
    description: message || undefined,
    duration: 3500,
    classNames: {
      toast: "cn-toast !py-2 !gap-1.5",
      title: "!text-sm !font-medium",
      description: "!text-xs !opacity-90 line-clamp-2",
    },
  });
}

function broadcastRealtime(detail: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REALTIME_EVENT, { detail }));
}

export function RealtimeProvider({ children }: PropsWithChildren) {
  const { socket, isConnected } = useSocket();
  const authUser = useAppSelector(selectAuthUser);
  const authRole = String(authUser?.role || "").toLowerCase();
  const [lastChatThreadId, setLastChatThreadId] = useState<string | null>(null);
  const [lastNotificationAt, setLastNotificationAt] = useState(0);
  const [presenceMap, setPresenceMap] = useState<Record<string, UserPresence>>({});
  const [supportOnline, setSupportOnline] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const activeThreadIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    // Clear orphaned NEW_NOTIFICATION handlers (HMR / failed prior cleanups).
    socket.removeAllListeners("NEW_NOTIFICATION");

    const onConnect = () => {
      if (activeThreadIdRef.current) {
        joinChatThread(activeThreadIdRef.current);
      }
      socket.emit("presence:support", {}, (res: { ok?: boolean; isOnline?: boolean }) => {
        if (res?.ok) setSupportOnline(Boolean(res.isOnline));
      });
      // Ask for full live online list (also pushed automatically as presence:snapshot)
      socket.emit("presence:snapshot:get", {}, (res: {
        ok?: boolean;
        users?: Array<{
          userId?: string | null;
          guestEmail?: string | null;
          isOnline?: boolean;
          lastSeen?: string;
          lastActiveAt?: string;
          role?: string | null;
        }>;
        supportOnline?: boolean;
      }) => {
        if (!res?.ok) return;
        applyPresenceSnapshot(res);
      });
    };

    const applyPresenceSnapshot = (snapshot: {
      users?: Array<{
        userId?: string | null;
        guestEmail?: string | null;
        isOnline?: boolean;
        lastSeen?: string;
        lastActiveAt?: string;
        role?: string | null;
      }>;
      supportOnline?: boolean;
    }) => {
      const users = Array.isArray(snapshot.users) ? snapshot.users : [];
      if (users.length) {
        setPresenceMap((prev) => {
          const next = { ...prev };
          for (const item of users) {
            const key = item.userId || item.guestEmail?.toLowerCase();
            if (!key) continue;
            next[key] = {
              isOnline: Boolean(item.isOnline ?? true),
              lastSeen: item.lastSeen,
              lastActiveAt: item.lastActiveAt,
            };
          }
          return next;
        });
      }
      if (typeof snapshot.supportOnline === "boolean") {
        setSupportOnline(snapshot.supportOnline);
      }
      broadcastRealtime({ type: "PRESENCE_SNAPSHOT", payload: snapshot });
    };

    socket.on("connect", onConnect);
    if (socket.connected) onConnect();

    const handlePresence = (payload: {
      userId?: string | null;
      guestEmail?: string | null;
      role?: string;
      support?: boolean;
      isOnline: boolean;
      lastSeen?: string;
      lastActiveAt?: string;
    }) => {
      if (payload?.support) {
        setSupportOnline(Boolean(payload.isOnline));
        broadcastRealtime({ type: "SUPPORT_PRESENCE", payload });
        return;
      }
      const role = String(payload?.role || "").toLowerCase();
      if (["admin", "owner", "moderator"].includes(role)) {
        if (payload.isOnline) {
          setSupportOnline(true);
        } else {
          // An admin went offline — re-check if any other admin remains
          socket.emit(
            "presence:support",
            {},
            (res: { ok?: boolean; isOnline?: boolean }) => {
              if (res?.ok) setSupportOnline(Boolean(res.isOnline));
            },
          );
        }
        broadcastRealtime({ type: "SUPPORT_PRESENCE", payload: { isOnline: Boolean(payload.isOnline), support: true } });
      }
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

    const handleSupportPresence = (payload: {
      isOnline?: boolean;
      support?: boolean;
    }) => {
      setSupportOnline(Boolean(payload?.isOnline));
      broadcastRealtime({ type: "SUPPORT_PRESENCE", payload });
    };

    const handlePresenceSnapshot = (payload: {
      users?: Array<{
        userId?: string | null;
        guestEmail?: string | null;
        isOnline?: boolean;
        lastSeen?: string;
        lastActiveAt?: string;
        role?: string | null;
      }>;
      supportOnline?: boolean;
    }) => {
      applyPresenceSnapshot(payload || {});
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
        const type = String(payload.type || "");
        // LEAD_CREATED already toasts once per request number — skip duplicate NEW_LEAD.
        if (type === "NEW_LEAD") return;
        // Provider-only booking request toast (customer gets "Booking request sent").
        if (type === "NEW_BOOKING_REQUEST" && authRole === "customer") return;
        const title =
          type === "NEW_BOOKING_REQUEST"
            ? "New booking request"
            : type === "BOOKING_ACCEPTED"
              ? "Booking accepted"
              : type === "BOOKING_REJECTED"
                ? "Booking declined"
                : type === "SERVICE_SCHEDULED"
                  ? "Service scheduled"
                  : String(payload.title);
        showNotificationToast(title, payload.message || undefined);
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
      onSocketEvent("DIRECT_CHAT_MESSAGE", (payload) => {
        broadcastRealtime({ type: "DIRECT_CHAT_MESSAGE", payload });
        broadcastRealtime({ type: "CUSTOMER_BADGE_INVALIDATE", payload });
      }),
      onSocketEvent("DIRECT_CHAT_READ", (payload) => {
        broadcastRealtime({ type: "DIRECT_CHAT_READ", payload });
        broadcastRealtime({ type: "CUSTOMER_BADGE_INVALIDATE", payload });
      }),
      onSocketEvent("USER_PRESENCE", handlePresence),
      onSocketEvent("chat:presence", handlePresence),
      onSocketEvent("SUPPORT_PRESENCE", handleSupportPresence),
      onSocketEvent("presence:snapshot", handlePresenceSnapshot),
      onSocketEvent("LEAD_CREATED", (payload) => {
        broadcastRealtime({ type: "LEAD_CREATED", payload });
        window.dispatchEvent(
          new CustomEvent("rs-realtime", { detail: { type: "INBOX_SUMMARY_INVALIDATE" } }),
        );
        showNotificationToast(
          "New lead",
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
      onSocketEvent("SERVICE_SCHEDULED", (payload) => {
        broadcastRealtime({ type: "SERVICE_SCHEDULED", payload });
        broadcastRealtime({ type: "CUSTOMER_BADGE_INVALIDATE", payload });
        // Domain event always reaches guest + user rooms; toast here so customers
        // still see it when NEW_NOTIFICATION is delayed or only guest-bound.
        if (authRole === "customer") {
          const title =
            (typeof payload?.title === "string" && payload.title.trim()) ||
            "Service scheduled";
          const message =
            (typeof payload?.message === "string" && payload.message.trim()) ||
            (payload?.number
              ? `${payload.number} was scheduled by your provider.`
              : "Your service has been scheduled.");
          showNotificationToast(title, message);
        }
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
        window.dispatchEvent(
          new CustomEvent("rs-realtime", {
            detail: { type: "INBOX_SUMMARY_INVALIDATE" },
          }),
        );
        const status = String(payload?.status || "");
        const action = String(payload?.action || "");
        // Role-aware fallback toasts when NEW_NOTIFICATION is delayed/missed.
        if (
          (status === "BOOKING_REQUESTED" || action === "requested") &&
          authRole === "provider"
        ) {
          showNotificationToast(
            "New booking request",
            payload?.number
              ? `${payload.number} needs your review.`
              : "A customer requested a booking.",
          );
        } else if (
          (action === "accept" || action === "auto_confirm") &&
          authRole === "customer"
        ) {
          showNotificationToast(
            "Booking accepted",
            payload?.number
              ? `${payload.number} was accepted by the provider.`
              : "Your booking was accepted.",
          );
        } else if (action === "reject" && authRole === "customer") {
          showNotificationToast(
            "Booking declined",
            payload?.number
              ? `${payload.number} was declined by the provider.`
              : "Your booking request was declined.",
          );
        } else if (
          action === "requested" &&
          authRole === "customer"
        ) {
          showNotificationToast(
            "Booking request sent",
            payload?.number
              ? `${payload.number} was sent. Waiting for the provider to accept.`
              : "Your booking request was sent.",
          );
        }
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
  }, [socket, authRole]);

  const joinThread = useCallback((threadId: string) => {
    activeThreadIdRef.current = threadId;
    setActiveThreadId(threadId);
    joinChatThread(threadId);
  }, []);

  const leaveThread = useCallback((threadId: string) => {
    if (activeThreadIdRef.current === threadId) {
      activeThreadIdRef.current = null;
      setActiveThreadId(null);
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
      supportOnline,
      activeThreadId,
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
      supportOnline,
      activeThreadId,
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
