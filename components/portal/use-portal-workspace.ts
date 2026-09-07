"use client";

import { handleUserLogout, getPersistedAuth } from "@/components/api/apiFuntions";
import { useAppSelector } from "@/store/hooks";
import {
  selectAuth,
  selectAuthUser,
  selectIsAuthenticated,
} from "@/store/authSlice";
import type { DemoSession } from "@/lib/auth/demo-session";
import { getPortalWorkspace } from "@/lib/data/portal";

export function usePortalWorkspace() {
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  const ready = auth.hydrated;
  const isProvider =
    isAuthenticated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");

  const persisted = ready ? getPersistedAuth() : null;
  const provider =
    persisted?.provider && typeof persisted.provider === "object"
      ? (persisted.provider as { companyName?: string })
      : null;

  const session: DemoSession | null =
    isProvider && user
      ? {
          role: "provider",
          firstName: String(user.firstName || ""),
          lastName: String(user.lastName || ""),
          email: String(user.email || ""),
          companyName:
            (typeof provider?.companyName === "string" &&
              provider.companyName) ||
            "Your company",
        }
      : null;

  return {
    ready,
    session,
    signOut: () => handleUserLogout(),
    ...getPortalWorkspace(session),
  };
}
