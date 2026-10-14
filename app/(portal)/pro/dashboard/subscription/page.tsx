import { SubscriptionPlansView } from "@/components/portal/views/subscription-plans-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Subscription",
  "Membership plans for Pros: dashboard access, lead matching, and the AI Voice Receptionist.",
  "/pro/dashboard/subscription",
);

export default function SubscriptionPage() {
  return <SubscriptionPlansView />;
}
