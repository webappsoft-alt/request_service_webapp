import { AiCallLogDetail } from "@/components/ai-calling";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "AI Call",
  "Full conversation and activity log for one AI receptionist call.",
  "/pro/dashboard/ai-receptionist/calls",
);

export default async function AiCallDetailPage({
  params,
}: PageParams<{ id: string }>) {
  const { id } = await params;
  // The header (title, back arrow, the call's Estimate / Schedule buttons on the right) is
  // rendered by AiCallLogDetail. Previous: <PortalPage eyebrow="AI Receptionist / Call history"
  // title="Call details" backHref=… backLabel="Call history"> around it here.
  return <AiCallLogDetail id={id} />;
}
