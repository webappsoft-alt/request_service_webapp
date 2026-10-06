import { PortalSuspense } from "@/components/portal/portal-suspense";
import { TimesheetsView } from "@/components/portal/views/timesheets-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Timesheets",
  "Review every technician's clocked hours by week, compare crews, and pay technicians.",
  "/pro/dashboard/timesheets",
);

export default function TimesheetsPage() {
  return (
    <PortalSuspense>
      <TimesheetsView />
    </PortalSuspense>
  );
}
