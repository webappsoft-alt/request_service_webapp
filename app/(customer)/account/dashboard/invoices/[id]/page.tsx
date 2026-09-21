import { CustomerInvoiceDetailDashboardView } from "@/components/account/customer-invoice-detail-dashboard-view";

export default async function CustomerDashboardInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomerInvoiceDetailDashboardView id={id} />;
}
