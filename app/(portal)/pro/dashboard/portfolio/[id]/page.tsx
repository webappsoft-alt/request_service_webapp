import { PortfolioFormView } from "@/components/portal/views/portfolio-view";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Edit portfolio project",
  "Update photos, tags, linked services, and project details.",
  "/pro/dashboard/portfolio",
);

export default async function EditPortfolioPage({
  params,
}: PageParams<{ id: string }>) {
  const { id } = await params;
  return <PortfolioFormView id={id} />;
}
