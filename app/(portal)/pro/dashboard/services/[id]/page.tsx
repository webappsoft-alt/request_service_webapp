import { ServiceFormView } from "@/components/portal/views/services-view";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Edit fixed service",
  "Update photos, price, coverage, service areas, and availability.",
  "/pro/dashboard/services",
);

export default async function EditServicePage({ params }: PageParams<{ id: string }>) {
  const { id } = await params;
  return <ServiceFormView id={id} />;
}
