import { SalesDashboardView } from "@/components/portal/views/sales-dashboard-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Sales dashboard",
  "Leads, estimates, invoices, and payments for this company.",
  "/pro/dashboard/sales",
);

export default function SalesDashboardPage() {
  return <SalesDashboardView />;
}
