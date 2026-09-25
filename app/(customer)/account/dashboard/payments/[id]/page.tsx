import { CustomerPaymentDetailDashboardView } from "@/components/account/customer-payment-detail-dashboard-view";

export default async function CustomerDashboardPaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomerPaymentDetailDashboardView id={id} />;
}
