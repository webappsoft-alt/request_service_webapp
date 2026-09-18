"use client";

import { io, type Socket } from "socket.io-client";

export type RealtimeEvents = {
  "socket:ready": {
    ok: boolean;
    role?: string;
    userId?: string | null;
    providerId?: string | null;
    guestEmail?: string | null;
  };
  CHAT_MESSAGE: {
    threadId: string;
    message: {
      id: string;
      from: "customer" | "provider" | "admin";
      text: string;
      at: string;
      isRead?: boolean;
      readAt?: string;
      attachments?: Array<{
        id?: string;
        name?: string;
        url: string;
        type?: string;
      }>;
    };
    thread?: unknown;
  };
  CHAT_THREAD_UPDATED: Record<string, unknown> & { id?: string };
  CHAT_TYPING: {
    threadId: string;
    from: "customer" | "provider" | "admin";
    isTyping: boolean;
  };
  CHAT_READ_RECEIPT: {
    threadId: string;
    readBy: "customer" | "provider" | "admin";
    readAt: string;
    unreadForProvider?: number;
    unreadForCustomer?: number;
    unreadForAdmin?: number;
  };
  USER_PRESENCE: {
    userId: string;
    isOnline: boolean;
    lastSeen?: string;
    lastActiveAt?: string;
  };
  "chat:presence": {
    userId: string;
    isOnline: boolean;
    lastSeen?: string;
    lastActiveAt?: string;
  };
  NEW_NOTIFICATION: {
    title?: string;
    message?: string;
    type?: string;
    data?: Record<string, unknown>;
  };
  LEAD_CREATED: {
    id: string;
    number?: string;
    href?: string;
  };
  INBOX_SUMMARY_INVALIDATE: {
    reason?: string;
    threadId?: string;
  };
  ESTIMATE_ACCEPTED: {
    estimateId?: string;
    number?: string;
    href?: string;
    customerName?: string;
  };
  ORDER_UPDATED: Record<string, unknown>;
  LEAD_STATUS_UPDATED: {
    id: string;
    status: string;
    requestId?: string;
    number?: string;
  };
  REQUEST_STATUS_UPDATED: {
    id: string;
    status: string;
    requestId?: string;
    number?: string;
  };
  LEAD_UPDATED: {
    id: string;
    status?: string;
    [key: string]: unknown;
  };
  REQUEST_UPDATED: {
    id: string;
    status?: string;
    [key: string]: unknown;
  };
  "lead:status": {
    id: string;
    status: string;
  };
  "request:status": {
    id: string;
    status: string;
  };
};

function socketBaseUrl() {
  const api = String(process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
  if (!api) return "";
  // API is typically .../api — socket mounts on the host root.
  return api.replace(/\/api$/i, "");
}

let socket: Socket | null = null;
let currentAuthKey = "";

export function getRealtimeSocket() {
  return socket;
}

export function connectRealtime(options: {
  token?: string | null;
  guestEmail?: string | null;
}) {
  if (typeof window === "undefined") return null;
  const base = socketBaseUrl();
  if (!base) return null;

  const token = options.token?.trim() || "";
  const guestEmail = options.guestEmail?.trim().toLowerCase() || "";
  const authKey = `${token}|${guestEmail}`;
  if (!token && !guestEmail) {
    disconnectRealtime();
    return null;
  }

  if (socket && currentAuthKey === authKey && socket.connected) {
    return socket;
  }

  disconnectRealtime();
  currentAuthKey = authKey;

  socket = io(base, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 12,
    reconnectionDelay: 1000,
    auth: {
      ...(token ? { token, Authorization: `Bearer ${token}` } : {}),
      ...(guestEmail ? { guestEmail, email: guestEmail } : {}),
    },
    extraHeaders: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  return socket;
}

export function disconnectRealtime() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  currentAuthKey = "";
}

export function joinChatThread(threadId: string) {
  if (!socket || !threadId) return;
  socket.emit("chat:join", { threadId });
  socket.emit("join", { room: `thread:${threadId}`, threadId });
  socket.emit("join:thread", { threadId });
}

export function leaveChatThread(threadId: string) {
  if (!socket || !threadId) return;
  socket.emit("chat:leave", { threadId });
  socket.emit("leave", { room: `thread:${threadId}`, threadId });
  socket.emit("leave:thread", { threadId });
}

export function emitChatTyping(
  threadId: string,
  isTyping: boolean,
  from?: "customer" | "provider" | "admin",
) {
  if (!socket || !threadId) return;
  socket.emit("chat:typing", { threadId, isTyping, ...(from ? { from } : {}) });
}

export function emitChatMarkRead(threadId: string) {
  if (!socket || !threadId) return;
  socket.emit("chat:mark_read", { threadId });
}

export function queryPresence(
  userIds: string | string[],
  onResult?: (
    results: Array<{
      userId: string;
      isOnline: boolean;
      lastSeen?: string;
      lastActiveAt?: string;
    }>,
  ) => void,
) {
  if (!socket || !userIds) return;
  const list = (Array.isArray(userIds) ? userIds : [userIds])
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  const validUserIds = list.filter((id) => /^[0-9a-fA-F]{24}$/.test(id));
  if (!validUserIds.length) return;

  socket.emit(
    "presence:query",
    { userIds: validUserIds, userId: validUserIds[0] },
    (response: any) => {
      if (response?.ok && Array.isArray(response.data)) {
        onResult?.(response.data);
      }
    },
  );
}

export function onRealtime<E extends keyof RealtimeEvents>(
  event: E,
  handler: (payload: RealtimeEvents[E]) => void,
) {
  if (!socket) return () => {};
  // Socket.IO listener generics don't line up cleanly with our typed event map.
  const listener = handler as (...args: any[]) => void;
  socket.on(event as string, listener);
  return () => {
    socket?.off(event as string, listener);
  };
}

export function emitLeadStatusChange(id: string, status: string) {
  if (!socket || !id) return;
  socket.emit("lead:status", { id, status });
  socket.emit("request:status", { id, status });
  socket.emit("LEAD_STATUS_UPDATED", { id, status });
  socket.emit("REQUEST_STATUS_UPDATED", { id, status });
}

