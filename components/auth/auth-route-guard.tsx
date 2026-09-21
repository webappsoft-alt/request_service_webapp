"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import { selectAuth } from "@/store/authSlice";
import { proPaths } from "@/lib/pro-paths";
import { customerPaths } from "@/lib/customer-paths";
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

function isProAuthPath(pathname: string): boolean {
  return (
    pathname === "/pro/login" ||
    pathname === "/pro/register" ||
    pathname === "/pro/signup" ||
    pathname === "/pro"
  );
}

/**
 * Client-side RBAC after Redux Persist rehydrates.
 * - Customers must never see /pro/* (including pro login).
 * - After customer login, send them home unless ?next= or a pending order resume exists.
 * - Providers redirect away from login/auth and customer account pages to /pro/dashboard.
 * - Public pages (estimates, services, landing) remain accessible to both.
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
        const search =
          typeof window !== "undefined" ? window.location.search : "";
        const next = encodeURIComponent(`${pathname}${search}`);
        router.replace(`/login?next=${next}`);
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
        router.replace(fromQuery || fromPending || customerPaths.site);
      }
      return;
    }

    if (role === "provider") {
      // Logged-in providers only redirect away from auth and customer account areas.
      if (
        isProAuthPath(pathname) ||
        isCustomerAuthPath(pathname) ||
        isCustomerProtected(pathname)
      ) {
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