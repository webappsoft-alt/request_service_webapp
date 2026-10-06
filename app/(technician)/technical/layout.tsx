import type { ReactNode } from "react";
import { TechnicianGate } from "@/components/technician/technician-gate";
import { TechnicianShell } from "@/components/technician/technician-shell";

export default function TechnicianLayout({ children }: { children: ReactNode }) {
  return (
    <TechnicianGate>
      <TechnicianShell>{children}</TechnicianShell>
    </TechnicianGate>
  );
}
