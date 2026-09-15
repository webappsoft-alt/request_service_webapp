"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import { selectIsAuthenticated, selectAuth } from "@/store/authSlice";
import { refreshAuthMe } from "@/components/api/apiFuntions";

/**
 * When the user is logged in, refresh profile via GET /user/me on route changes.
 */
export function AuthMeSync() {
  const pathname = usePathname();
  const auth = useAppSelector(selectAuth);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!auth.hydrated) return;
    if (!isAuthenticated) return;

    // One refresh after login/hydrate is enough. Re-hitting /me on every
    // sidebar click remounts portal state and can lock the CRM.
    const inPortal = pathname === "/pro" || pathname.startsWith("/pro/");
    if (inPortal && lastPath.current?.startsWith("/pro")) {
      lastPath.current = pathname;
      return;
    }
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;

    void refreshAuthMe().catch(() => {
      // 401 handled by api layer; ignore soft failures here
    });
  }, [pathname, isAuthenticated, auth.hydrated]);

  return null;
}
