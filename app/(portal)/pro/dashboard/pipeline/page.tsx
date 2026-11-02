import { PipelineView } from "@/components/portal/views/pipeline-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Pipeline",
  "Move leads, estimates, booked projects, jobs in progress and invoices through each stage.",
  "/pro/dashboard/pipeline",
);

export default function PipelinePage() {
  return <PipelineView />;
}
