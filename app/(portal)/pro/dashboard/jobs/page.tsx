import { PortalSuspense } from "@/components/portal/portal-suspense";
import { JobsView } from "@/components/portal/views/records-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Jobs",
  "Scheduled, in-progress, and completed jobs created from approved estimates.",
  "/pro/dashboard/jobs",
);

export default function JobsPage() {
  return (
    <PortalSuspense>
      <JobsView />
    </PortalSuspense>
  );
}
