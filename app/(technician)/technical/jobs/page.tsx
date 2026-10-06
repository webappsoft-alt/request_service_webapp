import { TechnicianJobsView } from "@/components/technician/views/technician-jobs-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata("My jobs", "Jobs assigned to you.", "/technical/jobs");

export default function TechnicianJobsPage() {
  return <TechnicianJobsView />;
}
