import { PortalSuspense } from "@/components/portal/portal-suspense";
import { ContractorDetailView } from "@/components/portal/views/people-directory-views";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Contractor file",
  "Contractor profile, compliance, and job history.",
  "/pro/dashboard/contractors",
);

export default async function ContractorDetailPage({ params }: PageParams<{ id: string }>) {
  const { id } = await params;
  return (
    <PortalSuspense>
      <ContractorDetailView id={id} />
    </PortalSuspense>
  );
}
