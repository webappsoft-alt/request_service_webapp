"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getSocketBaseUrl } from "@/components/socket/SocketProvider";
import { sendAssistantMessageRest, type PaReply } from "./pro-assistant-api";

export const PRO_ASSISTANT_NAMESPACE = "/pro-assistant";

type Handlers = {
  onDelta?: (clientMessageId: string | null, text: string) => void;
  onTyping?: (typing: boolean) => void;
};

/**
 * Realtime channel for the Pro assistant (Socket.IO namespace `/pro-assistant`, Pros only).
 * Connects lazily (first open) with the Pro's JWT; `send` resolves with the reply and falls back
 * to REST when the socket isn't connected, so a message is never lost.
 */
export function useProAssistantSocket({ token, enabled, handlers }: { token: string | null; enabled: boolean; handlers: Handlers }) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  const pendingRef = useRef(new Map<string, { resolve: (reply: PaReply) => void; reject: (error: Error) => void }>());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!enabled || !token) return undefined;
    const pending = pendingRef.current;
    const socket = io(`${getSocketBaseUrl()}${PRO_ASSISTANT_NAMESPACE}`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));
    socket.on("pa:typing", (event: { typing?: boolean }) => handlersRef.current.onTyping?.(Boolean(event?.typing)));
    socket.on("pa:delta", (event: { clientMessageId?: string | null; text?: string }) =>
      handlersRef.current.onDelta?.(event?.clientMessageId ?? null, String(event?.text || "")),
    );
    socket.on("pa:response", (reply: PaReply & { clientMessageId?: string | null }) => {
      const id = reply.clientMessageId || "";
      pending.get(id)?.resolve(reply);
      pending.delete(id);
    });
    socket.on("pa:error", (event: { clientMessageId?: string | null; message?: string }) => {
      const id = event?.clientMessageId || "";
      pending.get(id)?.reject(new Error(event?.message || "The assistant couldn't answer right now."));
      pending.delete(id);
    });
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      for (const entry of pending.values()) entry.reject(new Error("Connection closed."));
      pending.clear();
    };
  }, [enabled, token]);

  const send = useCallback(
    (clientMessageId: string, message: string, history: Array<{ role: string; text: string }>, conversationId: string | null) => {
      const socket = socketRef.current;
      if (!socket?.connected) return sendAssistantMessageRest(message, history, conversationId, clientMessageId);
      return new Promise<PaReply>((resolve, reject) => {
        const timer = setTimeout(() => {
          pendingRef.current.delete(clientMessageId);
          reject(new Error("The assistant took too long to answer. Please try again."));
        }, 45_000);
        pendingRef.current.set(clientMessageId, {
          resolve: (reply) => {
            clearTimeout(timer);
            resolve(reply);
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
        });
        socket.emit("pa:message", { clientMessageId, message, history, conversationId });
      });
    },
    [],
  );

  return { connected, send };
}
