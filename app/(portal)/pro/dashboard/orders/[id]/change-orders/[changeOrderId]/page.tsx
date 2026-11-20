import { OrderChangeOrderDetailView } from "@/components/portal/views/order-change-order-detail-view";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Change Order",
  "A change order sent to the customer on a fixed service order.",
  "/pro/dashboard/orders",
);

export default async function OrderChangeOrderPage({
  params,
}: PageParams<{ id: string; changeOrderId: string }>) {
  const { id, changeOrderId } = await params;
  return <OrderChangeOrderDetailView orderId={id} changeOrderId={changeOrderId} />;
}
