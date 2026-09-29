"use client";

import { useEffect } from "react";
import { useAppSelector } from "@/store/hooks";
import { selectIsAuthenticated, selectAuth } from "@/store/authSlice";
import { refreshAuthMe } from "@/components/api/apiFuntions";

/**
 * Module flag survives remounts / React Strict Mode.
 * One GET /user/me per logged-in session — not on every sidebar navigation,
 * and not again after token refresh or /me updating the user payload.
 */
let authMeSyncedThisSession = false;

/**
 * Refresh profile via GET /user/me once after auth hydrate.
 * Response updates existing auth user/provider via refreshAuthMe → updateAuthUser.
 */
export function AuthMeSync() {
  const auth = useAppSelector(selectAuth);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  useEffect(() => {
    if (!auth.hydrated) return;

    if (!isAuthenticated) {
      authMeSyncedThisSession = false;
      return;
    }

    if (authMeSyncedThisSession) return;
    authMeSyncedThisSession = true;

    void refreshAuthMe().catch(() => {
      // Soft failure — allow a later retry (e.g. after reconnect).
      authMeSyncedThisSession = false;
    });
  }, [isAuthenticated, auth.hydrated]);

  return null;
}
