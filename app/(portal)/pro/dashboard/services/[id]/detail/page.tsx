import { ServiceDetailView } from "@/components/portal/views/service-detail-view";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Fixed service detail",
  "View photos, price, coverage, service areas, and availability.",
  "/pro/dashboard/services",
);

export default async function ServiceDetailPage({
  params,
}: PageParams<{ id: string }>) {
  const { id } = await params;
  return <ServiceDetailView id={id} />;
}
