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
      from: "customer" | "provider";
      text: string;
      at: string;
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
    from: "customer" | "provider";
    isTyping: boolean;
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
  };
  ESTIMATE_ACCEPTED: {
    estimateId?: string;
    number?: string;
    href?: string;
    customerName?: string;
  };
  ORDER_UPDATED: Record<string, unknown>;
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
      ...(token ? { token } : {}),
      ...(guestEmail ? { guestEmail } : {}),
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
}

export function leaveChatThread(threadId: string) {
  if (!socket || !threadId) return;
  socket.emit("chat:leave", { threadId });
}

export function emitChatTyping(threadId: string, isTyping: boolean) {
  if (!socket || !threadId) return;
  socket.emit("chat:typing", { threadId, isTyping });
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
