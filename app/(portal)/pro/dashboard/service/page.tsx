import { ServiceDashboardView } from "@/components/portal/views/service-dashboard-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Service dashboard",
  "Jobs, schedule, and tasks for the field team.",
  "/pro/dashboard/service",
);

export default function ServiceDashboardPage() {
  return <ServiceDashboardView />;
}
