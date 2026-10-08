import { ContractorDashboardView } from "@/components/contractor/views/contractor-dashboard-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Contractor dashboard",
  "Your assigned jobs, approvals, and change requests.",
  "/contractor/dashboard",
);

export default function ContractorDashboardPage() {
  return <ContractorDashboardView />;
}
