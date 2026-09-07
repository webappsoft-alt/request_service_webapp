import { PortalSuspense } from "@/components/portal/portal-suspense";
import { PaymentsView } from "@/components/portal/views/records-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Payments",
  "Deposits and completion payments recorded against invoices.",
  "/pro/dashboard/payments",
);

export default function PaymentsPage() {
  return (
    <PortalSuspense>
      <PaymentsView />
    </PortalSuspense>
  );
}
