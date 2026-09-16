"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import {
  selectAuth,
  selectAuthUser,
  selectIsAuthenticated,
} from "@/store/authSlice";
import { customerPaths } from "@/lib/customer-paths";

export function CustomerGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const role = String(user?.role || auth.role || "").toLowerCase();
  const isCustomer =
    isAuthenticated &&
    Boolean(auth.token) &&
    (role === "customer" || role === "consumer" || role === "user");

  useEffect(() => {
    if (!auth.hydrated) return;
    if (!isCustomer) {
      router.replace(
        `/login?next=${encodeURIComponent(customerPaths.dashboard)}`,
      );
    }
  }, [auth.hydrated, isCustomer, router]);

  if (!auth.hydrated || !isCustomer) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#f5f5f5] text-sm text-muted-foreground">
        Opening your customer dashboard…
      </div>
    );
  }

  return children;
}
