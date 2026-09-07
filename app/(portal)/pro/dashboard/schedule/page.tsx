import { PortalSuspense } from "@/components/portal/portal-suspense";
import { ScheduleView } from "@/components/portal/views/schedule-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Schedule",
  "Assign jobs, estimate visits, and requests to technicians on the company calendar.",
  "/pro/dashboard/schedule",
);

export default function SchedulePage() {
  return (
    <PortalSuspense>
      <ScheduleView />
    </PortalSuspense>
  );
}
