import { ContractorJobDetailView } from "@/components/contractor/views/contractor-job-detail-view";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Job detail",
  "Requirements, completion proof, and change requests for an assigned job.",
  "/contractor/jobs",
);

export default async function ContractorJobDetailPage({ params }: PageParams<{ id: string }>) {
  const { id } = await params;
  return <ContractorJobDetailView id={id} />;
}
