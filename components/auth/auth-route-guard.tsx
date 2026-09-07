"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import { selectAuth } from "@/store/authSlice";

function isCustomerAuthPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/signup" ||
    pathname === "/verify-otp" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/register/")
  );
}

function isProAuthPath(pathname: string): boolean {
  return (
    pathname === "/pro/login" ||
    pathname === "/pro/register" ||
    pathname === "/pro/forgot-password" ||
    pathname === "/pro/reset-password"
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

function normalizeRole(role: string | null | undefined): "customer" | "provider" | null {
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

/**
 * Client-side RBAC after Redux Persist rehydrates.
 * Customers must never see /pro/* pages (including pro login).
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
        router.replace("/pro/login");
      }
      return;
    }

    if (role === "customer") {
      // Logged-in customers: never show pro marketing/auth/dashboard
      if (isProArea(pathname)) {
        router.replace("/");
        return;
      }
      if (isCustomerAuthPath(pathname)) {
        router.replace("/");
      }
      return;
    }

    if (role === "provider") {
      if (isProAuthPath(pathname)) {
        router.replace("/pro/dashboard");
        return;
      }
      if (isCustomerAuthPath(pathname) || isCustomerProtected(pathname)) {
        router.replace("/pro/dashboard");
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
