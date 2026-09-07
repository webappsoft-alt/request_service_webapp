import { ProfileView } from "@/components/portal/views/profile-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Business profile",
  "Edit the company details shown on your public marketplace page.",
  "/pro/dashboard/profile",
);

export default function ProfilePage() {
  return <ProfileView />;
}
