"use client";

import { handleUserLogout } from "@/components/api/apiFuntions";
import { useAppSelector } from "@/store/hooks";
import {
  selectAuth,
  selectAuthProvider,
  selectAuthUser,
  selectIsAuthenticated,
} from "@/store/authSlice";
import type { DemoSession } from "@/lib/auth/demo-session";
import { getPortalWorkspace } from "@/lib/data/portal";

export function usePortalWorkspace() {
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const authProvider = useAppSelector(selectAuthProvider);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  const ready = auth.hydrated;
  const isProvider =
    isAuthenticated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");

  const companyName =
    (typeof authProvider?.companyName === "string" &&
      authProvider.companyName.trim()) ||
    "Your company";

  const session: DemoSession | null =
    isProvider && user
      ? {
          role: "provider",
          firstName: String(user.firstName || ""),
          lastName: String(user.lastName || ""),
          email: String(user.email || authProvider?.email || ""),
          companyName,
        }
      : null;

  const workspace = getPortalWorkspace(session);

  return {
    ready,
    session,
    authProvider,
    signOut: () => handleUserLogout(),
    ...workspace,
    provider: {
      ...workspace.provider,
      companyName,
      email: String(user?.email || authProvider?.email || workspace.provider.email),
      phone: String(authProvider?.phone || workspace.provider.phone || ""),
      website:
        typeof authProvider?.website === "string"
          ? authProvider.website
          : workspace.provider.website,
      tagline: String(authProvider?.tagline || workspace.provider.tagline || ""),
      description: String(
        authProvider?.description || workspace.provider.description || "",
      ),
      slug: String(authProvider?.slug || workspace.provider.slug || ""),
      street: String(authProvider?.location?.address || workspace.provider.street || ""),
      city: String(authProvider?.location?.city || workspace.provider.city || ""),
      state: String(
        (typeof authProvider?.location?.state === "string" &&
          authProvider.location.state) ||
          workspace.provider.state ||
          "",
      ),
      zip: String(authProvider?.location?.zip || workspace.provider.zip || ""),
      licensed: Boolean(
        authProvider?.profile?.licensed ?? workspace.provider.licensed,
      ),
      insured: Boolean(
        authProvider?.profile?.insured ?? workspace.provider.insured,
      ),
      categoryIds: Array.isArray(authProvider?.services?.categoryIds)
        ? authProvider.services.categoryIds
        : workspace.provider.categoryIds,
      contact: {
        name:
          [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
          workspace.provider.contact?.name ||
          "Owner",
        role: String(
          authProvider?.contactRole ||
            workspace.provider.contact?.role ||
            "Business owner",
        ),
      },
      yearsInBusiness:
        typeof authProvider?.profile?.yearsInBusiness === "number"
          ? authProvider.profile.yearsInBusiness
          : workspace.provider.yearsInBusiness,
      employeeCount: String(
        authProvider?.profile?.employeeCount ||
          workspace.provider.employeeCount ||
          "",
      ),
      startingPrice:
        typeof authProvider?.services?.startingPrice === "number"
          ? authProvider.services.startingPrice
          : workspace.provider.startingPrice,
      workingHours:
        Array.isArray(authProvider?.settings?.workingHours) &&
        authProvider.settings.workingHours.length
          ? authProvider.settings.workingHours.map((entry) => ({
              day: entry.day,
              open: entry.open ?? null,
              close: entry.close ?? null,
              closed: Boolean(entry.closed),
            }))
          : workspace.provider.workingHours,
    },
  };
}
