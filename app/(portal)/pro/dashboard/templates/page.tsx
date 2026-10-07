import { EstimateTemplatesView } from "@/components/portal/views/estimate-templates-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Templates",
  "Ready-made estimate templates for your services.",
  "/pro/dashboard/templates",
);

export default function EstimateTemplatesPage() {
  return <EstimateTemplatesView />;
}
