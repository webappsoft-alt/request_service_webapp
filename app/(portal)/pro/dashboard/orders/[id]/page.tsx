import { OrderDetailPageView } from "@/components/portal/views/order-detail-page-view";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Order Execution Detail",
  "Operational job view with property location, GPS coordinates, change orders, and work completion.",
  "/pro/dashboard/orders",
);

export default async function OrderDetailPage({
  params,
}: PageParams<{ id: string }>) {
  const { id } = await params;
  return <OrderDetailPageView id={id} />;
}
