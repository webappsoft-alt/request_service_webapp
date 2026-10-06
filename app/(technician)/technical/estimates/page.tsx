import { TechnicianEstimatesView } from "@/components/technician/views/technician-estimates-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata("My estimates", "Estimate visits assigned to you.", "/technical/estimates");

export default function TechnicianEstimatesPage() {
  return <TechnicianEstimatesView />;
}
