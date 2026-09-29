"use client";

import { useEffect, useRef } from "react";
import { useAppSelector } from "@/store/hooks";
import { selectIsAuthenticated, selectAuth } from "@/store/authSlice";
import { refreshAuthMe } from "@/components/api/apiFuntions";

/**
 * Refresh profile via GET /user/me once after auth hydrate — not on every
 * in-app navigation (that was causing duplicate /me calls on each sidebar click).
 */
export function AuthMeSync() {
  const auth = useAppSelector(selectAuth);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const fetchedForSession = useRef<string | null>(null);

  useEffect(() => {
    if (!auth.hydrated) return;
    if (!isAuthenticated) {
      fetchedForSession.current = null;
      return;
    }
    const sessionKey = String(auth.token || auth.user?.id || "auth");
    if (fetchedForSession.current === sessionKey) return;
    fetchedForSession.current = sessionKey;

    void refreshAuthMe().catch(() => {
      // 401 + refresh handled by api layer; ignore soft failures here
    });
  }, [isAuthenticated, auth.hydrated, auth.token, auth.user?.id]);

  return null;
}
