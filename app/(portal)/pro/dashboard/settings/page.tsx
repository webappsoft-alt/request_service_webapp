import { BusinessProfileDetailView } from "@/components/portal/views/business-profile-detail-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Business Profile",
  "Review your public company details and edit them step by step.",
  "/pro/dashboard/settings",
);

export default function SettingsPage() {
  return <BusinessProfileDetailView />;
}
