import { ContractorPayoutsView } from "@/components/contractor/views/contractor-payouts-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Invoices / Payouts",
  "Approved jobs and accepted change orders.",
  "/contractor/payouts",
);

export default function ContractorPayoutsPage() {
  return <ContractorPayoutsView />;
}
