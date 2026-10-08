"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import { selectAuth } from "@/store/authSlice";
import { proPaths } from "@/lib/pro-paths";
import { customerPaths } from "@/lib/customer-paths";
import { readPendingFixedOrder } from "@/lib/booking/pending-fixed-order";
import { isTechnicianPath, technicianPaths } from "@/lib/technician-paths";
import {
  contractorPaths,
  isContractorLoginPath,
  isContractorPath,
} from "@/lib/contractor-paths";

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

function isProLanding(pathname: string): boolean {
  return pathname === "/pro" || pathname === "/pro/";
}

function isProDashboard(pathname: string): boolean {
  return (
    pathname === "/pro/dashboard" || pathname.startsWith("/pro/dashboard/")
  );
}

function isProAuthPath(pathname: string): boolean {
  return (
    pathname === "/pro/login" ||
    pathname === "/pro/register" ||
    pathname === "/pro/forgot-password" ||
    pathname === "/pro/reset-password" ||
    pathname === "/pro/verify-otp" ||
    pathname === "/pro/verify-forgot-otp" ||
    pathname.startsWith("/pro/login/") ||
    pathname.startsWith("/pro/register/")
  );
}

function isCustomerProtected(pathname: string): boolean {
  return pathname === "/account" || pathname.startsWith("/account/");
}

/** Public customer estimate review/sign links (must work even when a Pro is logged in). */
function isPublicEstimateSharePath(pathname: string): boolean {
  if (pathname === "/e" || pathname.startsWith("/e/")) return true;
  // Legacy share route: /{uuid}
  return /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i.test(
    pathname,
  );
}

function normalizeRole(
  role: string | null | undefined,
): "customer" | "provider" | "technician" | "contractor" | null {
  if (!role) return null;
  const value = role.toLowerCase();
  if (value === "technician") return "technician";
  if (value === "contractor") return "contractor";
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
 * - After customer login, send them to the customer landing (/) unless ?next= or a pending order resume exists.
 * - After provider login, send them to the provider dashboard (/pro/dashboard).
 * - Providers may stay on /pro/dashboard/* and on public estimate share links (/e/*, legacy UUID).
 * - Other customer marketing/account routes bounce providers to the dashboard.
 * - Technicians are confined to /technical/*; everyone else is kept out of it.
 * - Contractors are confined to /contractor/*; everyone else only sees /contractor/login
 *   while signed out.
 *   (The API enforces the same rules — this only avoids rendering wrong pages.)
 */
export function AuthRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAppSelector(selectAuth);

  const role = auth.hydrated
    ? normalizeRole(auth.role || auth.user?.role)
    : null;
  const loggedIn = Boolean(
    auth.hydrated && auth.token && auth.isAuthenticated,
  );
  /** Hide chrome while bouncing a logged-in provider off customer marketing/auth. */
  const providerOffPortal =
    loggedIn &&
    role === "provider" &&
    !isProDashboard(pathname) &&
    !isPublicEstimateSharePath(pathname);
  /** Hide pro chrome while bouncing a logged-in customer off /pro. */
  const customerOnPro = loggedIn && role === "customer" && isProArea(pathname);
  /** Technicians only ever see /technical/* — hide anything else while redirecting. */
  const technicianOffPortal =
    loggedIn && role === "technician" && !isTechnicianPath(pathname);
  /** Non-technicians never see the technician portal. */
  const nonTechnicianOnTechnical =
    auth.hydrated && role !== "technician" && isTechnicianPath(pathname);
  /** Contractors only ever see the contractor portal (not its login while signed in). */
  const contractorOffPortal =
    loggedIn &&
    role === "contractor" &&
    (!isContractorPath(pathname) || isContractorLoginPath(pathname));
  /** Signed-in non-contractors never see the contractor portal; signed-out visitors only its login. */
  const nonContractorOnContractor =
    auth.hydrated &&
    role !== "contractor" &&
    isContractorPath(pathname) &&
    (loggedIn || !isContractorLoginPath(pathname));

  useEffect(() => {
    if (!auth.hydrated) return;

    const nextRole = normalizeRole(auth.role || auth.user?.role);
    const nextLoggedIn = Boolean(auth.token && auth.isAuthenticated);

    if (!nextLoggedIn) {
      if (isCustomerProtected(pathname)) {
        const search =
          typeof window !== "undefined" ? window.location.search : "";
        const next = encodeURIComponent(`${pathname}${search}`);
        router.replace(`/login?next=${next}`);
      } else if (isContractorPath(pathname)) {
        if (!isContractorLoginPath(pathname)) router.replace(contractorPaths.login);
      } else if (isProDashboard(pathname) || isTechnicianPath(pathname)) {
        router.replace(proPaths.login);
      }
      return;
    }

    if (nextRole === "contractor") {
      // Provider, technician, customer, and marketing routes are all off-limits.
      if (!isContractorPath(pathname) || isContractorLoginPath(pathname)) {
        router.replace(contractorPaths.dashboard);
      }
      return;
    }

    if (isContractorPath(pathname)) {
      router.replace(
        nextRole === "provider"
          ? proPaths.dashboard
          : nextRole === "technician"
            ? technicianPaths.dashboard
            : customerPaths.site,
      );
      return;
    }

    if (nextRole === "technician") {
      // Provider, customer, and marketing routes are all off-limits.
      if (!isTechnicianPath(pathname)) {
        router.replace(technicianPaths.dashboard);
      }
      return;
    }

    if (isTechnicianPath(pathname)) {
      router.replace(nextRole === "provider" ? proPaths.dashboard : customerPaths.site);
      return;
    }

    if (nextRole === "customer") {
      if (isProArea(pathname)) {
        router.replace(customerPaths.site);
        return;
      }
      if (isCustomerAuthPath(pathname)) {
        // Prefer ?next=… (order resume), then pending order returnPath, else marketing home.
        const fromQuery = readNextFromLocation();
        const fromPending = safeInternalPath(
          readPendingFixedOrder()?.returnPath,
        );
        router.replace(fromQuery || fromPending || customerPaths.site);
      }
      return;
    }

    if (nextRole === "provider") {
      // Stay on dashboard and public estimate customer-view links.
      if (isProDashboard(pathname) || isPublicEstimateSharePath(pathname)) {
        return;
      }
      if (isProAuthPath(pathname) || isProLanding(pathname) || !isProArea(pathname)) {
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

  if (
    providerOffPortal ||
    customerOnPro ||
    technicianOffPortal ||
    nonTechnicianOnTechnical ||
    contractorOffPortal ||
    nonContractorOnContractor
  ) {
    return null;
  }

  return <>{children}</>;
}
