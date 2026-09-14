import { PortalSuspense } from "@/components/portal/portal-suspense";
import { ProfileView } from "@/components/portal/views/profile-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Edit business profile",
  "Update your company details step by step: basic data, hours, services, and portfolio.",
  "/pro/dashboard/profile",
);

export default function ProfilePage() {
  return (
    <PortalSuspense>
      <ProfileView />
    </PortalSuspense>
  );
}
