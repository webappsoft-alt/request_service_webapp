import { PortalSuspense } from "@/components/portal/portal-suspense";
import { RemindersView } from "@/components/portal/views/people-directory-views";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Reminders",
  "Follow-ups tied to customer accounts.",
  "/pro/dashboard/reminders",
);

export default function RemindersPage() {
  return (
    <PortalSuspense>
      <RemindersView />
    </PortalSuspense>
  );
}
