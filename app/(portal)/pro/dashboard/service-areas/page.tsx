import { ServiceAreasView } from "@/components/portal/views/service-areas-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Service areas",
  "Manage operational zones and coverage locations for fixed services.",
  "/pro/dashboard/service-areas",
);

export default function ServiceAreasPage() {
  return <ServiceAreasView />;
}
