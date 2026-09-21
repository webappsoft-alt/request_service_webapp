import { redirect } from "next/navigation";
import { EstimateDetailView } from "@/components/portal/views/record-detail-views";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Estimate detail",
  "Line items, terms, and approval status for a written estimate.",
  "/pro/dashboard/estimates",
);

export default async function EstimateDetailPage({
  params,
  searchParams,
}: PageParams<{ id: string }>) {
  const { id } = await params;
  if (id === "new") {
    const sp = await searchParams;
    const query = new URLSearchParams();
    if (sp) {
      for (const [k, v] of Object.entries(sp)) {
        if (typeof v === "string") query.set(k, v);
        else if (Array.isArray(v)) v.forEach((val) => query.append(k, val));
      }
    }
    const qs = query.toString();
    redirect(`/pro/dashboard/estimates/new${qs ? `?${qs}` : ""}`);
  }
  return <EstimateDetailView id={id} />;
}
