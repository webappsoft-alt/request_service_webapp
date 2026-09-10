"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import { selectAuth } from "@/store/authSlice";
import { proPaths } from "@/lib/pro-paths";
import { readPendingFixedOrder } from "@/lib/booking/pending-fixed-order";

function isCustomerAuthPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/signup" ||
    pathname === "/verify-otp" ||
    pathname === "/verify-forgot-otp" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/register/")
  );
}

function isProArea(pathname: string): boolean {
  return pathname === "/pro" || pathname.startsWith("/pro/");
}

function isProDashboard(pathname: string): boolean {
  return (
    pathname === "/pro/dashboard" || pathname.startsWith("/pro/dashboard/")
  );
}

function isCustomerProtected(pathname: string): boolean {
  return pathname === "/account" || pathname.startsWith("/account/");
}

function normalizeRole(
  role: string | null | undefined,
): "customer" | "provider" | null {
  if (!role) return null;
  const value = role.toLowerCase();
  if (value === "customer" || value === "consumer" || value === "user") {
    return "customer";
  }
  if (value === "provider" || value === "pro" || value === "professional") {
    return "provider";
  }
  return null;
}

function safeInternalPath(value: string | null | undefined): string | null {
  const next = String(value || "").trim();
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

function readNextFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return safeInternalPath(
      new URLSearchParams(window.location.search).get("next"),
    );
  } catch {
    return null;
  }
}

/**
 * Client-side RBAC after Redux Persist rehydrates.
 * - Customers must never see /pro/* (including pro login).
 * - Providers stay inside /pro/dashboard/* only.
 */
export function AuthRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAppSelector(selectAuth);

  useEffect(() => {
    if (!auth.hydrated) return;

    const role = normalizeRole(auth.role || auth.user?.role);
    const loggedIn = Boolean(auth.token && auth.isAuthenticated);

    if (!loggedIn) {
      if (isCustomerProtected(pathname)) {
        router.replace("/login");
      } else if (isProDashboard(pathname)) {
        router.replace(proPaths.login);
      }
      return;
    }

    if (role === "customer") {
      if (isProArea(pathname)) {
        router.replace("/");
        return;
      }
      if (isCustomerAuthPath(pathname)) {
        // Prefer ?next=… (order resume), then pending order returnPath, else home.
        const fromQuery = readNextFromLocation();
        const fromPending = safeInternalPath(
          readPendingFixedOrder()?.returnPath,
        );
        router.replace(fromQuery || fromPending || "/");
      }
      return;
    }

    if (role === "provider") {
      // Logged-in providers only use dashboard routes (and nested pages).
      if (!isProDashboard(pathname)) {
        router.replace(proPaths.dashboard);
      }
    }
  }, [
    auth.hydrated,
    auth.isAuthenticated,
    auth.role,
    auth.token,
    auth.user?.role,
    pathname,
    router,
  ]);

  return <>{children}</>;
}