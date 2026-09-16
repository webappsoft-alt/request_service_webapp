import { AccountSettingsView } from "@/components/account/account-settings-view";
import { PortalPage } from "@/components/portal/portal-page";

export default function CustomerDashboardSettingsPage() {
  return (
    <PortalPage
      eyebrow="Account"
      title="Settings"
      description="Update your profile details, photo, location, and password."
    >
      <AccountSettingsView embedded />
    </PortalPage>
  );
}
