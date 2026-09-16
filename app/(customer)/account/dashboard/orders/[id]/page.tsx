import { CustomerOrderDetailView } from "@/components/account/customer-order-detail-view";

export default async function CustomerDashboardOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomerOrderDetailView orderId={id} embedded />;
}
