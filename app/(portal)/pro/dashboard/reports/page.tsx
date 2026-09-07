import { ReportsView } from "@/components/portal/views/reports-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Reports",
  "Revenue, jobs, estimates, customers, and invoice aging.",
  "/pro/dashboard/reports",
);

export default function ReportsPage() {
  return <ReportsView />;
}
