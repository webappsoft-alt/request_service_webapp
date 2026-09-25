"use client";

import type { Socket } from "socket.io-client";

/**
 * Shared socket API used with SocketProvider.
 * Connection is created only by SocketProvider — these helpers emit/listen on that one instance.
 */

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
  DIRECT_CHAT_MESSAGE: {
    chatId?: string;
    peerUserId?: string;
    message?: Record<string, unknown>;
    chat?: Record<string, unknown>;
  };
  DIRECT_CHAT_READ: {
    chatId?: string;
    peerUserId?: string;
    unreadForAdmin?: number;
    unreadForPeer?: number;
  };
  USER_PRESENCE: {
    userId: string;
    isOnline: boolean;
    lastSeen?: string;
    lastActiveAt?: string;
  };
  SUPPORT_PRESENCE: {
    isOnline: boolean;
    support?: boolean;
    role?: string;
    lastSeen?: string;
  };
  "presence:snapshot": {
    users: Array<{
      userId?: string | null;
      guestEmail?: string | null;
      role?: string | null;
      isOnline: boolean;
      lastSeen?: string;
    }>;
    supportOnline?: boolean;
    at?: string;
  };
  "chat:presence": {
    userId: string;
    isOnline: boolean;
    lastSeen?: string;
    lastActiveAt?: string;
  };
  NEW_NOTIFICATION: {
    id?: string;
    title?: string;
    message?: string;
    type?: string;
    data?: Record<string, unknown>;
    notification?: Record<string, unknown>;
  };
  CUSTOMER_BADGE_INVALIDATE: {
    reason?: string;
    threadId?: string;
    orderId?: string;
    estimateId?: string;
    invoiceId?: string;
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
  ESTIMATE_SENT: {
    estimateId?: string;
    number?: string;
    href?: string;
    shareUrl?: string;
  };
  SERVICE_SCHEDULED: {
    kind?: string;
    recordId?: string;
    number?: string;
    scheduledDate?: string;
    href?: string;
    title?: string;
    message?: string;
  };
  ESTIMATE_UPDATED: {
    estimateId?: string;
    number?: string;
    status?: string;
    href?: string;
    providerId?: string;
  };
  INVOICE_SENT: {
    invoiceId?: string;
    number?: string;
    href?: string;
  };
  PAYMENT_RECEIVED: {
    invoiceId?: string;
    paymentId?: string;
    number?: string;
    amount?: number;
    href?: string;
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

export const SOCKET_AUTH_EVENT = "rs-socket-auth";

export type SocketAuthDetail = {
  token?: string | null;
  guestEmail?: string | null;
  disconnect?: boolean;
};

type AnyHandler = (...args: any[]) => void;

/** Filled only by SocketProvider — never create io() here. */
let sharedSocket: Socket | null = null;

const listenerRegistry = new Map<string, Set<AnyHandler>>();

function attachRegistry(socket: Socket) {
  for (const [event, handlers] of listenerRegistry) {
    for (const handler of handlers) {
      socket.off(event, handler);
      socket.on(event, handler);
    }
  }
}

function detachRegistry(socket: Socket) {
  for (const [event, handlers] of listenerRegistry) {
    for (const handler of handlers) {
      socket.off(event, handler);
    }
  }
}

/** Internal: SocketProvider registers the live connection. */
export function bindSharedSocket(socket: Socket | null) {
  if (sharedSocket === socket) return;
  if (sharedSocket) detachRegistry(sharedSocket);
  sharedSocket = socket;
  if (socket) attachRegistry(socket);
}

export function getSocket() {
  return sharedSocket;
}

/** @deprecated Prefer getSocket() — same shared provider instance. */
export function getRealtimeSocket() {
  return sharedSocket;
}

/** Tell SocketProvider to use guest/token auth on the shared connection. */
export function connectSocket(options: {
  token?: string | null;
  guestEmail?: string | null;
}) {
  if (typeof window === "undefined") return getSocket();
  window.dispatchEvent(
    new CustomEvent<SocketAuthDetail>(SOCKET_AUTH_EVENT, {
      detail: {
        token: options.token ?? null,
        guestEmail: options.guestEmail ?? null,
      },
    }),
  );
  return getSocket();
}

/** @deprecated Use connectSocket — does not create a connection. */
export function connectRealtime(options: {
  token?: string | null;
  guestEmail?: string | null;
}) {
  return connectSocket(options);
}

export function disconnectSocket() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<SocketAuthDetail>(SOCKET_AUTH_EVENT, {
      detail: { token: null, guestEmail: null, disconnect: true },
    }),
  );
}

/** @deprecated Use disconnectSocket. */
export function disconnectRealtime() {
  disconnectSocket();
}

export function joinChatThread(threadId: string) {
  if (!sharedSocket || !threadId) return;
  sharedSocket.emit("chat:join", { threadId });
  sharedSocket.emit("join", { room: `thread:${threadId}`, threadId });
  sharedSocket.emit("join:thread", { threadId });
}

export function leaveChatThread(threadId: string) {
  if (!sharedSocket || !threadId) return;
  sharedSocket.emit("chat:leave", { threadId });
  sharedSocket.emit("leave", { room: `thread:${threadId}`, threadId });
  sharedSocket.emit("leave:thread", { threadId });
}

export function emitChatTyping(
  threadId: string,
  isTyping: boolean,
  from?: "customer" | "provider" | "admin",
) {
  if (!sharedSocket || !threadId) return;
  sharedSocket.emit("chat:typing", {
    threadId: String(threadId),
    isTyping: Boolean(isTyping),
    ...(from ? { from } : {}),
  });
}

export function emitChatMarkRead(threadId: string) {
  if (!sharedSocket || !threadId) return;
  sharedSocket.emit("chat:mark_read", { threadId });
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
  if (!sharedSocket || !userIds) return;
  const list = (Array.isArray(userIds) ? userIds : [userIds])
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  const validUserIds = list.filter((id) => /^[0-9a-fA-F]{24}$/.test(id));
  if (!validUserIds.length) return;

  sharedSocket.emit(
    "presence:query",
    { userIds: validUserIds, userId: validUserIds[0] },
    (response: any) => {
      if (response?.ok && Array.isArray(response.data)) {
        onResult?.(response.data);
      }
    },
  );
}

/** Subscribe to a socket event on the shared SocketProvider connection. */
export function onSocketEvent<E extends keyof RealtimeEvents>(
  event: E,
  handler: (payload: RealtimeEvents[E]) => void,
) {
  const eventName = event as string;
  const listener = handler as AnyHandler;

  let handlers = listenerRegistry.get(eventName);
  if (!handlers) {
    handlers = new Set();
    listenerRegistry.set(eventName, handlers);
  }
  handlers.add(listener);

  // Capture the socket we attach to — cleanup must off THIS instance even if
  // bindSharedSocket(null) already ran (otherwise orphaned handlers stack toasts).
  const attachedTo = sharedSocket;
  if (attachedTo) {
    attachedTo.off(eventName, listener);
    attachedTo.on(eventName, listener);
  }

  return () => {
    handlers?.delete(listener);
    if (handlers && handlers.size === 0) {
      listenerRegistry.delete(eventName);
    }
    attachedTo?.off(eventName, listener);
    if (sharedSocket && sharedSocket !== attachedTo) {
      sharedSocket.off(eventName, listener);
    }
  };
}

/** @deprecated Use onSocketEvent. */
export function onRealtime<E extends keyof RealtimeEvents>(
  event: E,
  handler: (payload: RealtimeEvents[E]) => void,
) {
  return onSocketEvent(event, handler);
}

export function emitLeadStatusChange(id: string, status: string) {
  if (!sharedSocket || !id) return;
  sharedSocket.emit("lead:status", { id, status });
  sharedSocket.emit("request:status", { id, status });
  sharedSocket.emit("LEAD_STATUS_UPDATED", { id, status });
  sharedSocket.emit("REQUEST_STATUS_UPDATED", { id, status });
}
