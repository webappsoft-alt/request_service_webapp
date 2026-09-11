import { CustomerOrderDetailView } from "@/components/account/customer-order-detail-view";
import { buildMetadata } from "@/lib/seo";
import type { PageParams } from "@/lib/page-props";

export async function generateMetadata({
  params,
}: PageParams<{ id: string }>) {
  const { id } = await params;
  return buildMetadata({
    title: "Order details",
    description: "Private order details for your Request Services account.",
    path: `/account/orders/${id}`,
    index: false,
    follow: false,
  });
}

export default async function CustomerOrderDetailPage({
  params,
}: PageParams<{ id: string }>) {
  const { id } = await params;
  return <CustomerOrderDetailView orderId={id} />;
}
