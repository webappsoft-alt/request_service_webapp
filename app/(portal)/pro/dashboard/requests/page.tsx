import { PortalSuspense } from "@/components/portal/portal-suspense";
import { RequestsView } from "@/components/portal/views/requests-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Leads",
  "Qualify inbound requests, write the estimate, and start the job.",
  "/pro/dashboard/requests",
);

export default function RequestsPage() {
  return (
    <PortalSuspense>
      <RequestsView />
    </PortalSuspense>
  );
}
