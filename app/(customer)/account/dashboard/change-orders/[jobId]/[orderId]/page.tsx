import { CustomerChangeOrderDetailView } from "@/components/account/customer-change-order-detail-view";
import type { PageParams } from "@/lib/page-props";

export default async function CustomerChangeOrderDetailPage({
  params,
}: PageParams<{ jobId: string; orderId: string }>) {
  const { jobId, orderId } = await params;
  return <CustomerChangeOrderDetailView jobId={jobId} orderId={orderId} />;
}
