import { PortalSuspense } from "@/components/portal/portal-suspense";
import { EstimatesView } from "@/components/portal/views/records-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Estimates",
  "Draft, sent, accepted, and expired written estimates.",
  "/pro/dashboard/estimates",
);

export default function EstimatesPage() {
  return (
    <PortalSuspense>
      <EstimatesView />
    </PortalSuspense>
  );
}
