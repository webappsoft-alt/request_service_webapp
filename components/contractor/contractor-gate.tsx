"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser, selectIsAuthenticated } from "@/store/authSlice";
import { contractorPaths, isContractorRole } from "@/lib/contractor-paths";
import { proPaths } from "@/lib/pro-paths";
import { isTechnicianRole, technicianPaths } from "@/lib/technician-paths";

/**
 * Client guard for the contractor portal. The API independently rejects
 * non-contractor tokens on /api/contractor/* and contractor tokens elsewhere.
 */
export function ContractorGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const role = user?.role || auth.role;
  const isContractor = isAuthenticated && Boolean(auth.token) && isContractorRole(role);

  useEffect(() => {
    if (!auth.hydrated || isContractor) return;
    if (!isAuthenticated) {
      router.replace(contractorPaths.login);
    } else if (role === "provider") {
      router.replace(proPaths.dashboard);
    } else if (isTechnicianRole(role)) {
      router.replace(technicianPaths.dashboard);
    } else {
      router.replace("/");
    }
  }, [auth.hydrated, isAuthenticated, isContractor, role, router]);

  if (!auth.hydrated || !isContractor) {
    return (
      <div className="contractor-theme flex min-h-svh items-center justify-center bg-[var(--ct-bg)] text-sm text-muted-foreground">
        Opening your contractor portal…
      </div>
    );
  }

  return children;
}
