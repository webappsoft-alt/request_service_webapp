"use client";

import { usePathname } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import { selectAuth } from "@/store/authSlice";
import { isSessionSwitchPending } from "@/lib/session-scope";

/**
 * True for the moment a tab moves into another role's portal and its saved session is being swapped in
 * (lib/session-scope.ts). Gates show their loading state and skip redirects until the swap is done.
 */
export function useSessionSwitchPending(): boolean {
  const pathname = usePathname() || "/";
  const auth = useAppSelector(selectAuth);
  return (
    auth.hydrated &&
    isSessionSwitchPending(
      pathname,
      auth.role || auth.user?.role,
      Boolean(auth.token && auth.isAuthenticated),
      auth.sessionScope,
    )
  );
}
