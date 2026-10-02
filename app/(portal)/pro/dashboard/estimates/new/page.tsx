import { redirect } from "next/navigation";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Create estimate",
  "Draft and send an itemized estimate proposal to a customer.",
  "/pro/dashboard/new-estimate/new",
);

export default async function NewEstimatePage({ searchParams }: PageParams) {
  const sp = await searchParams;
  const query = new URLSearchParams();
  if (sp) {
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === "string") query.set(k, v);
      else if (Array.isArray(v)) v.forEach((val) => query.append(k, val));
    }
  }
  const qs = query.toString();
  redirect(`/pro/dashboard/new-estimate/new${qs ? `?${qs}` : ""}`);
}
