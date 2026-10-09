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
import { isTechnicianRole, technicianPaths } from "@/lib/technician-paths";
import { contractorPaths, isContractorRole } from "@/lib/contractor-paths";

export function PortalGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isProvider =
    isAuthenticated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");

  const isTechnician = isTechnicianRole(user?.role || auth.role);
  const isContractor = isContractorRole(user?.role || auth.role);

  useEffect(() => {
    if (!auth.hydrated) return;
    if (isTechnician) {
      // Technicians have their own portal; provider pages are never rendered for them.
      router.replace(technicianPaths.dashboard);
      return;
    }
    if (isContractor) {
      // Contractors have their own portal too.
      router.replace(contractorPaths.dashboard);
      return;
    }
    if (!isProvider) {
      router.replace(proPaths.login);
    }
  }, [auth.hydrated, isProvider, isTechnician, isContractor, router]);

  if (!auth.hydrated || !isProvider) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#f5f5f5] dark:bg-slate-900 text-sm text-muted-foreground dark:text-slate-400">
        Opening your business portal…
      </div>
    );
  }

  return children;
}
