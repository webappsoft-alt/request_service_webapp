import { PortalSuspense } from "@/components/portal/portal-suspense";
import { InvoicesView } from "@/components/portal/views/records-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Invoices",
  "Draft, sent, paid, and overdue invoices with balances.",
  "/pro/dashboard/invoices",
);

export default function InvoicesPage() {
  return (
    <PortalSuspense>
      <InvoicesView />
    </PortalSuspense>
  );
}
