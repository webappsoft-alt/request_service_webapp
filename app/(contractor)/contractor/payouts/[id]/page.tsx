import { ContractorPayoutDetailView } from "@/components/contractor/views/contractor-payout-detail-view";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Payout",
  "A payment from the office: the job or order it paid for, your time sessions and the balance.",
  "/contractor/payouts",
);

export default async function ContractorPayoutPage({ params }: PageParams<{ id: string }>) {
  const { id } = await params;
  return <ContractorPayoutDetailView id={id} />;
}
