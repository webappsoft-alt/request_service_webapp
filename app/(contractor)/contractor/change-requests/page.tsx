import { ContractorChangeRequestsView } from "@/components/contractor/views/contractor-change-requests-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Change requests",
  "Change orders you've requested and the office's response.",
  "/contractor/change-requests",
);

export default function ContractorChangeRequestsPage() {
  return <ContractorChangeRequestsView />;
}
