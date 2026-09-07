import { DashboardView } from "@/components/portal/views/dashboard-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Provider dashboard",
  "See new requests, active jobs, estimates, and outstanding invoices for your company.",
  "/pro/dashboard",
);

export default function DashboardPage() {
  return <DashboardView />;
}
