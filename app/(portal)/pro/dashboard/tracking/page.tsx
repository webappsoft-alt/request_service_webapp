import { PortalSuspense } from "@/components/portal/portal-suspense";
import { TrackingView } from "@/components/portal/views/tracking-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Employee tracking",
  "Live locations of employees and subcontractors on the clock, and each person's route by day.",
  "/pro/dashboard/tracking",
);

export default function TrackingPage() {
  return (
    <PortalSuspense>
      <TrackingView />
    </PortalSuspense>
  );
}
