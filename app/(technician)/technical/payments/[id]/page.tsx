import { TechnicianPaymentDetailView } from "@/components/technician/views/technician-payment-detail-view";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Payment",
  "A payment from the office: the job it paid for, your time sessions and the balance.",
  "/technical/payments",
);

export default async function TechnicianPaymentPage({ params }: PageParams<{ id: string }>) {
  const { id } = await params;
  return <TechnicianPaymentDetailView id={id} />;
}
