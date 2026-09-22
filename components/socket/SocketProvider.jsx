"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { io } from "socket.io-client";
import Cookies from "js-cookie";
import { decryptData } from "@/components/api/encrypted";

const SocketContext = createContext({
  socket: null,
  isConnected: false,
});

const TOKEN_COOKIE = "token-binsweb-user";

function readAuthToken() {
  if (typeof window === "undefined") return null;

  const cookieToken = Cookies.get(TOKEN_COOKIE);
  if (cookieToken) {
    return decryptData(cookieToken);
  }

  const localToken = localStorage.getItem(TOKEN_COOKIE);
  return localToken ? decryptData(localToken) : null;
}

function getSocketBaseUrl() {
  const fromEnv =
    process.env.NEXT_PUBLIC_SOCKET_BASE_URL ||
    "";

  if (fromEnv) {
    return fromEnv.replace(/\/api\/?$/, "").replace(/\/$/, "");
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  if (apiBase) {
    return apiBase.replace(/\/api\/?$/, "").replace(/\/$/, "");
  }

  return "";
}

/**
 * Reusable Socket.IO provider.
 * Connects when an auth token is present and disconnects on logout.
 * Use `useSocket()` anywhere to access the live socket instance.
 */
export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [token, setToken] = useState(null);

  const syncToken = useCallback(() => {
    setToken(readAuthToken());
  }, []);

  useEffect(() => {
    syncToken();

    const onAuthChange = () => syncToken();
    window.addEventListener("auth-change", onAuthChange);
    window.addEventListener("storage", onAuthChange);

    const interval = setInterval(() => {
      const current = readAuthToken();
      setToken((prev) => (prev !== current ? current : prev));
    }, 1000);

    return () => {
      window.removeEventListener("auth-change", onAuthChange);
      window.removeEventListener("storage", onAuthChange);
      clearInterval(interval);
    };
  }, [syncToken]);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      setIsConnected(false);
      return;
    }

    const baseUrl = getSocketBaseUrl();
    if (!baseUrl) {
      console.error("❌ [Socket] Base URL is not configured!");
      return;
    }

    console.log("🔌 [Socket] Connecting to:", baseUrl);

    const newSocket = io(baseUrl, {
      path: "/socket.io/",
      transports: ["websocket", "polling"],
      upgrade: true,
      withCredentials: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      auth: { token },
      query: { token },
    });

    // Attach immediately so chat listeners are ready before the first emit.
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("✅ [Socket] Connected successfully | Socket ID:", newSocket.id);
      setIsConnected(true);
      setSocket(newSocket);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("❌ [Socket] Disconnected | Reason:", reason);
      setIsConnected(false);
    });

    newSocket.on("connect_error", (err) => {
      const message = err?.message || String(err);
      console.warn("⚠️ [Socket] Connection error:", message);
      setIsConnected(false);
    });

    newSocket.io.on("reconnect_attempt", (attempt) => {
      console.log(`🔄 [Socket] Reconnection attempt #${attempt}...`);
    });

    newSocket.io.on("reconnect", (attempt) => {
      console.log(`✅ [Socket] Reconnected successfully after ${attempt} attempts!`);
    });

    return () => {
      console.log("🔌 [Socket] Cleaning up socket connection...");
      newSocket.removeAllListeners();
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

/** Returns the socket context object `{ socket, isConnected }` safely. */
export const useSocket = () => {
  const context = useContext(SocketContext);
  return {
    socket: context?.socket || null,
    isConnected: context?.isConnected || false,
    socketId: context?.socket?.id || null,
  };
};

/** Full context: `{ socket, isConnected }`. */
export const useSocketContext = useSocket;

/**
 * Emit a Socket.IO event and wait for the ack callback.
 * Rejects on timeout (default 15s, matching mobile).
 */
export function emitWithAck(socket, event, payload, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error("Socket is not connected"));
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error("Request timed out. Please try again."));
    }, timeoutMs);

    socket.emit(event, payload, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

export default SocketProvider;
