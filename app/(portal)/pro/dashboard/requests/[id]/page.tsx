import { RequestDetailView } from "@/components/portal/views/request-detail-view";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Lead",
  "Qualify the request, write the estimate, and convert it to a job.",
  "/pro/dashboard/requests",
);

export default async function RequestDetailPage({ params }: PageParams<{ id: string }>) {
  const { id } = await params;
  return <RequestDetailView id={id} />;
}
