import type { ReactNode } from "react";
import { ContractorGate } from "@/components/contractor/contractor-gate";
import { ContractorShell } from "@/components/contractor/contractor-shell";

export default function ContractorLayout({ children }: { children: ReactNode }) {
  return (
    <ContractorGate>
      <ContractorShell>{children}</ContractorShell>
    </ContractorGate>
  );
}
