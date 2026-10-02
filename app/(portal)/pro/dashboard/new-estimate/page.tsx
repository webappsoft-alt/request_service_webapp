import { NewEstimateListView } from "@/components/portal/estimate-v2/new-estimate-list-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Estimate",
  "Estimate workflow: customer, property, assessment, then pricing.",
  "/pro/dashboard/new-estimate",
);

export default function NewEstimateIndexPage() {
  return <NewEstimateListView />;
}
