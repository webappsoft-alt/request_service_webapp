"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser, selectIsAuthenticated } from "@/store/authSlice";
import { proPaths } from "@/lib/pro-paths";
import { isTechnicianRole } from "@/lib/technician-paths";
import { contractorPaths, isContractorRole } from "@/lib/contractor-paths";

/**
 * Client guard for /technical/*. The API independently rejects non-technician
 * tokens on /api/technician/* and technician tokens everywhere else.
 */
export function TechnicianGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const role = user?.role || auth.role;
  const isTechnician = isAuthenticated && Boolean(auth.token) && isTechnicianRole(role);

  useEffect(() => {
    if (!auth.hydrated || isTechnician) return;
    if (!isAuthenticated) {
      router.replace(proPaths.login);
    } else if (role === "provider") {
      router.replace(proPaths.dashboard);
    } else if (isContractorRole(role)) {
      router.replace(contractorPaths.dashboard);
    } else {
      router.replace("/");
    }
  }, [auth.hydrated, isAuthenticated, isTechnician, role, router]);

  if (!auth.hydrated || !isTechnician) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#f5f5f5] text-sm text-muted-foreground">
        Opening your technician portal…
      </div>
    );
  }

  return children;
}
