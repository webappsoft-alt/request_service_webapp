import { TechnicianPaymentsView } from "@/components/technician/views/technician-payments-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Payments",
  "What you've earned, what's been paid, and what's still owed — job by job.",
  "/technical/payments",
);

export default function TechnicianPaymentsPage() {
  return <TechnicianPaymentsView />;
}
