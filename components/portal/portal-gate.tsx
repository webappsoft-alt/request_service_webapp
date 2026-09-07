"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useDemoSession } from "@/components/auth/use-demo-session";

export function PortalGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { session, ready } = useDemoSession();

  useEffect(() => {
    if (!ready) return;
    if (!session || session.role !== "provider") {
      router.replace("/pro/login");
    }
  }, [ready, router, session]);

  if (!ready || !session || session.role !== "provider") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#f5f5f5] text-sm text-muted-foreground">
        Opening your business portal…
      </div>
    );
  }

  return children;
}
