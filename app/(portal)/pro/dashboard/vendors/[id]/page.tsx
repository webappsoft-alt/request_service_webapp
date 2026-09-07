import { PortalSuspense } from "@/components/portal/portal-suspense";
import { VendorDetailView } from "@/components/portal/views/people-directory-views";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Vendor file",
  "Vendor profile and account terms.",
  "/pro/dashboard/vendors",
);

export default async function VendorDetailPage({ params }: PageParams<{ id: string }>) {
  const { id } = await params;
  return (
    <PortalSuspense>
      <VendorDetailView id={id} />
    </PortalSuspense>
  );
}
