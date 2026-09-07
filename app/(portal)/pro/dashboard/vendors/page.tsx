import { PortalSuspense } from "@/components/portal/portal-suspense";
import { VendorsView } from "@/components/portal/views/people-directory-views";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Vendors",
  "Supply houses and accounts payable.",
  "/pro/dashboard/vendors",
);

export default function VendorsPage() {
  return (
    <PortalSuspense>
      <VendorsView />
    </PortalSuspense>
  );
}
