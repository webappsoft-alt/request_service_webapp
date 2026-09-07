import { BillingView } from "@/components/portal/views/billing-settings-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Subscription",
  "Current plan, upgrades, and billing period for the provider portal.",
  "/pro/dashboard/billing",
);

export default function BillingPage() {
  return <BillingView />;
}
