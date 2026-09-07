import { PortalSuspense } from "@/components/portal/portal-suspense";
import { PaymentDetailView } from "@/components/portal/views/record-detail-views";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Payment detail",
  "Payment amount, method, and the invoice it was applied to.",
  "/pro/dashboard/payments",
);

export default async function PaymentDetailPage({ params }: PageParams<{ id: string }>) {
  const { id } = await params;
  return (
    <PortalSuspense>
      <PaymentDetailView id={id} />
    </PortalSuspense>
  );
}
