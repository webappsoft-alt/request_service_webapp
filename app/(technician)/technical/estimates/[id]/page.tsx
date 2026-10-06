import { TechnicianEstimateDetailView } from "@/components/technician/views/technician-estimates-view";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Estimate detail",
  "Site visit, scope, and time tracking for an assigned estimate.",
  "/technical/estimates",
);

export default async function TechnicianEstimateDetailPage({ params }: PageParams<{ id: string }>) {
  const { id } = await params;
  return <TechnicianEstimateDetailView id={id} />;
}
