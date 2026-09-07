import { JobDetailView } from "@/components/portal/views/record-detail-views";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Job detail",
  "Schedule, original estimate, change orders, and invoice for a job.",
  "/pro/dashboard/jobs",
);

export default async function JobDetailPage({ params }: PageParams<{ id: string }>) {
  const { id } = await params;
  return <JobDetailView id={id} />;
}
