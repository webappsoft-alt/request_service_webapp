import { TechnicianJobDetailView } from "@/components/technician/views/technician-job-detail-view";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Job detail",
  "Customer, location, scope, and clock in / clock out for an assigned job.",
  "/technical/jobs",
);

export default async function TechnicianJobDetailPage({ params }: PageParams<{ id: string }>) {
  const { id } = await params;
  return <TechnicianJobDetailView id={id} />;
}
