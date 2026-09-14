import { PortfolioDetailView } from "@/components/portal/views/portfolio-detail-view";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Portfolio project detail",
  "View photos, cost, tags, and linked fixed services.",
  "/pro/dashboard/portfolio",
);

export default async function PortfolioDetailPage({
  params,
}: PageParams<{ id: string }>) {
  const { id } = await params;
  return <PortfolioDetailView id={id} />;
}
