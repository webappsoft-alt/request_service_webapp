import { TechnicianDashboardView } from "@/components/technician/views/technician-dashboard-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Technician dashboard",
  "Your assigned jobs, estimates, schedule, and hours for today.",
  "/technical",
);

export default function TechnicianDashboardPage() {
  return <TechnicianDashboardView />;
}
