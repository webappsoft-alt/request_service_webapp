import { InvoiceDetailView } from "@/components/portal/views/record-detail-views";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Invoice detail",
  "Original estimate items, change orders, payments, and balance due.",
  "/pro/dashboard/invoices",
);

export default async function InvoiceDetailPage({ params }: PageParams<{ id: string }>) {
  const { id } = await params;
  return <InvoiceDetailView id={id} />;
}
