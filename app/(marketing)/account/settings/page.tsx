import { AccountSettingsView } from "@/components/account/account-settings-view";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Account Settings",
  description: "Manage your Request Services customer account settings.",
  path: "/account/settings",
  index: false,
  follow: false,
});

export default function AccountSettingsPage() {
  return <AccountSettingsView />;
}
