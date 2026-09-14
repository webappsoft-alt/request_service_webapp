import type { ReactNode } from "react";
import { CrmDataProvider } from "@/components/portal/crm-data-provider";
import { PortalGate } from "@/components/portal/portal-gate";
import { PortalShell } from "@/components/portal/portal-shell";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <PortalGate>
      <CrmDataProvider>
        <PortalShell>{children}</PortalShell>
      </CrmDataProvider>
    </PortalGate>
  );
}
