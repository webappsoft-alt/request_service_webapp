import type { ReactNode } from "react";
import { Suspense } from "react";

export function PortalSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>{children}</Suspense>;
}
