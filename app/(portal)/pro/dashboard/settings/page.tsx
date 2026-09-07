import { SettingsView } from "@/components/portal/views/billing-settings-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Settings",
  "Account email, notifications, and company office hours.",
  "/pro/dashboard/settings",
);

export default function SettingsPage() {
  return <SettingsView />;
}
