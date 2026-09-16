import type { ReactNode } from "react";
import { CustomerGate } from "@/components/account/customer-gate";
import { CustomerShell } from "@/components/account/customer-shell";

export default function CustomerDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <CustomerGate>
      <CustomerShell>{children}</CustomerShell>
    </CustomerGate>
  );
}
