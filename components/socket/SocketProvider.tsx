"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { readChatGuest } from "@/lib/booking/chat-store";
import {
  bindSharedSocket,
  SOCKET_AUTH_EVENT,
  type SocketAuthDetail,
} from "@/components/socket/socket-api";
import { useAppSelector } from "@/store/hooks";
import {
  selectAuth,
  selectAuthToken,
  selectIsAuthenticated,
} from "@/store/authSlice";

type SocketContextValue = {
  socket: Socket | null;
  isConnected: boolean;
  socketId: string | null;
};

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  socketId: null,
});

/** Socket host from env only — never hardcode. */
function getSocketBaseUrl() {
  const fromEnv = String(process.env.NEXT_PUBLIC_SOCKET_BASE_URL || "").trim();
  if (fromEnv) {
    return fromEnv.replace(/\/api\/?$/i, "").replace(/\/$/, "");
  }

  const apiBase = String(process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
  if (apiBase) {
    return apiBase.replace(/\/api\/?$/i, "").replace(/\/$/, "");
  }

  return "";
}

function normalizeGuestEmail(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/**
 * App-wide Socket.IO provider — the only place that creates the socket connection.
 * Use `useSocket()` / `onSocketEvent()` everywhere else.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const auth = useAppSelector(selectAuth);
  const reduxToken = useAppSelector(selectAuthToken);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [guestEmailOverride, setGuestEmailOverride] = useState<string | null>(null);

  const token = auth.hydrated && isAuthenticated ? reduxToken?.trim() || null : null;

  const guestEmail = useMemo(() => {
    if (token) return null;
    const override = normalizeGuestEmail(guestEmailOverride);
    if (override) return override;
    return normalizeGuestEmail(readChatGuest()?.email) || null;
  }, [guestEmailOverride, token]);

  const authKey = `${token || ""}|${guestEmail || ""}`;

  useEffect(() => {
    const onSocketAuth = (event: Event) => {
      const detail = (event as CustomEvent<SocketAuthDetail>).detail || {};
      if (detail.disconnect) {
        setGuestEmailOverride(null);
        return;
      }
      if ("guestEmail" in detail) {
        setGuestEmailOverride(normalizeGuestEmail(detail.guestEmail) || null);
      }
    };

    const onStorage = () => {
      setGuestEmailOverride(normalizeGuestEmail(readChatGuest()?.email) || null);
    };

    window.addEventListener(SOCKET_AUTH_EVENT, onSocketAuth);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(SOCKET_AUTH_EVENT, onSocketAuth);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!auth.hydrated) return;

    if (!token && !guestEmail) {
      bindSharedSocket(null);
      setSocket(null);
      setIsConnected(false);
      return;
    }

    const baseUrl = getSocketBaseUrl();
    if (!baseUrl) {
      console.error("[Socket] NEXT_PUBLIC_SOCKET_BASE_URL / NEXT_PUBLIC_API_BASE_URL is not configured");
      return;
    }

    const nextSocket = io(baseUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      withCredentials: false,
      auth: {
        ...(token ? { token, Authorization: `Bearer ${token}` } : {}),
        ...(guestEmail ? { guestEmail, email: guestEmail } : {}),
      },
      query: {
        ...(token ? { token } : {}),
        ...(guestEmail ? { guestEmail } : {}),
      },
      extraHeaders: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    bindSharedSocket(nextSocket);
    setSocket(nextSocket);
    setIsConnected(nextSocket.connected);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    const onConnectError = () => setIsConnected(false);

    nextSocket.on("connect", onConnect);
    nextSocket.on("disconnect", onDisconnect);
    nextSocket.on("connect_error", onConnectError);

    return () => {
      nextSocket.off("connect", onConnect);
      nextSocket.off("disconnect", onDisconnect);
      nextSocket.off("connect_error", onConnectError);
      nextSocket.disconnect();
      bindSharedSocket(null);
      setSocket(null);
      setIsConnected(false);
    };
  }, [auth.hydrated, authKey, guestEmail, token]);

  const value = useMemo<SocketContextValue>(
    () => ({
      socket,
      isConnected,
      socketId: socket?.id || null,
    }),
    [socket, isConnected],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

/** Shared socket instance + connection flag for any page/component. */
export function useSocket() {
  const context = useContext(SocketContext);
  return {
    socket: context?.socket || null,
    isConnected: context?.isConnected || false,
    socketId: context?.socket?.id || null,
  };
}

export const useSocketContext = useSocket;

/**
 * Emit a Socket.IO event and wait for the ack callback.
 * Rejects on timeout (default 15s).
 */
export function emitWithAck<T = unknown>(
  socket: Socket | null | undefined,
  event: string,
  payload: unknown,
  timeoutMs = 15000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error("Socket is not connected"));
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error("Request timed out. Please try again."));
    }, timeoutMs);

    socket.emit(event, payload, (response: T) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

export default SocketProvider;
