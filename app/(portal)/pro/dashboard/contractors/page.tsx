import { PortalSuspense } from "@/components/portal/portal-suspense";
import { ContractorsView } from "@/components/portal/views/people-directory-views";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Contractors",
  "Subcontractors and specialty trades used on jobs.",
  "/pro/dashboard/contractors",
);

export default function ContractorsPage() {
  return (
    <PortalSuspense>
      <ContractorsView />
    </PortalSuspense>
  );
}
