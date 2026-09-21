import { NewEstimateView } from "@/components/portal/views/new-estimate-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Create estimate",
  "Draft and send an itemized estimate proposal to a customer.",
  "/pro/dashboard/estimates/new",
);

export default function NewEstimatePage() {
  return <NewEstimateView />;
}
