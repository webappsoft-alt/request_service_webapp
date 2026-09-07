import { PortalSuspense } from "@/components/portal/portal-suspense";
import { ReminderDetailView } from "@/components/portal/views/people-directory-views";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Reminder",
  "Customer follow-up details.",
  "/pro/dashboard/reminders",
);

export default async function ReminderDetailPage({ params }: PageParams<{ id: string }>) {
  const { id } = await params;
  return (
    <PortalSuspense>
      <ReminderDetailView id={id} />
    </PortalSuspense>
  );
}
