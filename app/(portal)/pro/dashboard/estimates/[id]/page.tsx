import { EstimateDetailView } from "@/components/portal/views/record-detail-views";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Estimate detail",
  "Line items, terms, and approval status for a written estimate.",
  "/pro/dashboard/estimates",
);

export default async function EstimateDetailPage({ params }: PageParams<{ id: string }>) {
  const { id } = await params;
  return <EstimateDetailView id={id} />;
}
