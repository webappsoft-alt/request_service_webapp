"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getSocketBaseUrl } from "@/components/socket/SocketProvider";
import type { BotServerReply } from "../types";

export const BOT_SOCKET_NAMESPACE = "/bot-ai";

export type BotSocketLocation = {
  city?: string;
  state?: string;
  zip?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
};

export type BotSocketAction =
  | { type: "select_provider"; providerId: string; providerName?: string }
  | { type: "quote_request" }
  | {
      type: "select_service";
      categorySlug: string;
      subCategorySlug: string | null;
      label: string;
    }
  | { type: "choose_path"; path: "pros" | "services" }
  | { type: "location_changed" }
  | {
      type: "quote_brief";
      providerId: string | null;
      providerName: string | null;
      categorySlug: string | null;
      serviceTitle: string | null;
    }
  | { type: "quote_submitted"; requestNumber: string; providerName: string | null; count: number; quoteBatchId: string | null };

export type BotSocketPayload = {
  sessionId: string;
  clientMessageId: string;
  message?: string;
  action?: BotSocketAction;
  location?: BotSocketLocation;
  userId?: string | null;
};

export type BotSocketHandlers = {
  /** Fired on every (re)connect, e.g. after sign-in swaps the socket for an authenticated one. */
  onConnect?: () => void;
  onTyping?: (typing: boolean) => void;
  onDelta?: (event: { clientMessageId: string | null; text: string }) => void;
  onResponse?: (reply: BotServerReply) => void;
  onError?: (event: { clientMessageId: string | null; code: string; message: string }) => void;
};

/**
 * Realtime channel for the AI assistant. Uses the `/bot-ai` namespace on the same
 * Socket.IO server as the app socket (the client multiplexes namespaces over one
 * connection), and works for guests: the backend identifies them by sessionId.
 * Reconnects with the JWT when the user signs in.
 */
export function useBotSocket({
  token,
  enabled,
  handlers,
}: {
  token: string | null;
  /** Connect lazily — only once the assistant is used. */
  enabled: boolean;
  handlers: BotSocketHandlers;
}) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  // Messages sent before the socket exists (e.g. hero search opens + sends at once).
  const queueRef = useRef<BotSocketPayload[]>([]);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!enabled) return;
    const baseUrl = getSocketBaseUrl();
    if (!baseUrl) {
      console.error("[bot-ai] NEXT_PUBLIC_SOCKET_BASE_URL / NEXT_PUBLIC_API_BASE_URL is not configured");
      return;
    }

    const socket = io(`${baseUrl}${BOT_SOCKET_NAMESPACE}`, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: token ? { token } : {},
    });
    socketRef.current = socket;
    for (const queued of queueRef.current.splice(0)) socket.emit("bot:message", queued);

    const onConnect = () => {
      setConnected(true);
      handlersRef.current.onConnect?.();
    };
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onDisconnect);
    socket.on("bot:typing", (event: { typing?: boolean }) => handlersRef.current.onTyping?.(Boolean(event?.typing)));
    socket.on("bot:delta", (event) => handlersRef.current.onDelta?.(event));
    socket.on("bot:response", (reply: BotServerReply) => handlersRef.current.onResponse?.(reply));
    socket.on("bot:error", (event) => handlersRef.current.onError?.(event));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
      setConnected(false);
    };
  }, [enabled, token]);

  /** Emit `bot:message`. Socket.IO buffers it until the connection is up. */
  const sendMessage = useCallback((payload: BotSocketPayload) => {
    const socket = socketRef.current;
    if (!socket) {
      queueRef.current.push(payload);
      return;
    }
    socket.emit("bot:message", payload);
  }, []);

  return { connected, sendMessage };
}
