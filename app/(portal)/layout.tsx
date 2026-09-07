import type { ReactNode } from "react";
import { PortalGate } from "@/components/portal/portal-gate";
import { PortalShell } from "@/components/portal/portal-shell";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <PortalGate>
      <PortalShell>{children}</PortalShell>
    </PortalGate>
  );
}
