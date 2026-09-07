import { PortalSuspense } from "@/components/portal/portal-suspense";
import { CustomerDetailView } from "@/components/portal/views/customer-detail-view";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Customer file",
  "Profile, estimates, jobs, schedule, invoices, and reminders.",
  "/pro/dashboard/customers",
);

export default async function CustomerDetailPage({ params }: PageParams<{ id: string }>) {
  const { id } = await params;
  return (
    <PortalSuspense>
      <CustomerDetailView id={id} />
    </PortalSuspense>
  );
}
