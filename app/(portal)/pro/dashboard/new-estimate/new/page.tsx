import { NewEstimateCreateView } from "@/components/portal/estimate-v2/new-estimate-create-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "New estimate",
  "Create an estimate and choose how it will be prepared.",
  "/pro/dashboard/new-estimate/new",
);

export default function NewEstimateCreatePage() {
  return <NewEstimateCreateView />;
}
