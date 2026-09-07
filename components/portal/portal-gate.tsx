"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import {
  selectAuth,
  selectAuthUser,
  selectIsAuthenticated,
} from "@/store/authSlice";
import { proPaths } from "@/lib/pro-paths";

export function PortalGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isProvider =
    isAuthenticated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");

  useEffect(() => {
    if (!auth.hydrated) return;
    if (!isProvider) {
      router.replace(proPaths.login);
    }
  }, [auth.hydrated, isProvider, router]);

  if (!auth.hydrated || !isProvider) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#f5f5f5] text-sm text-muted-foreground">
        Opening your business portal…
      </div>
    );
  }

  return children;
}
