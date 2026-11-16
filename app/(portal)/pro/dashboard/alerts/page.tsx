import { RemindersAlertsView } from "@/components/portal/views/reminders-alerts-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Daily alerts",
  "Morning briefing, customer reminders and missed check-in alerts.",
  "/pro/dashboard/alerts",
);

export default function DailyAlertsPage() {
  return <RemindersAlertsView />;
}
