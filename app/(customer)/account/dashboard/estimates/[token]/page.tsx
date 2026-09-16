import { CustomerEstimateDetailDashboardView } from "@/components/account/customer-estimate-detail-dashboard-view";

export default async function CustomerDashboardEstimateDetailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <CustomerEstimateDetailDashboardView token={token} />;
}
