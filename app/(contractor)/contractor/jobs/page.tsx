import { ContractorJobsView } from "@/components/contractor/views/contractor-jobs-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Assigned jobs",
  "Jobs assigned to you with labor, material, and equipment requirements.",
  "/contractor/jobs",
);

export default function ContractorJobsPage() {
  return <ContractorJobsView />;
}
