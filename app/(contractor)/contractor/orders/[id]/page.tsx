import { PortalSuspense } from "@/components/portal/portal-suspense";
import { OrderDetailPageView } from "@/components/portal/views/order-detail-page-view";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Order detail",
  "Customer, property, scope, check in / out, change orders and completion proof for an assigned order.",
  "/contractor/orders",
);

/** Contractor portal: run an assigned fixed service order (same screen as the Pro's). */
export default async function ContractorOrderDetailPage({ params }: PageParams<{ id: string }>) {
  const { id } = await params;
  return (
    <PortalSuspense>
      <OrderDetailPageView id={id} viewer="contractor" />
    </PortalSuspense>
  );
}
