import type { ReactNode } from "react";
import { Suspense } from "react";
import { CenteredSpinner } from "@/components/ui/spinner";

export function PortalSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<CenteredSpinner label="Loading..." className="min-h-64" />}>
      {children}
    </Suspense>
  );
}

