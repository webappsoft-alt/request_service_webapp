"use client";

import { useDemoSession } from "@/components/auth/use-demo-session";
import { getPortalWorkspace } from "@/lib/data/portal";

export function usePortalWorkspace() {
  const { session, ready, signOut } = useDemoSession();
  return {
    ready,
    session,
    signOut,
    ...getPortalWorkspace(session),
  };
}
