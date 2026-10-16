import { AiCallLogDetail } from "@/components/ai-calling";
import { PortalPage } from "@/components/portal/portal-page";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "AI Call",
  "Full conversation and activity log for one AI receptionist call.",
  "/pro/dashboard/ai-receptionist/calls",
);

export default async function AiCallDetailPage({ params }: PageParams<{ id: string }>) {
  const { id } = await params;
  return (
    <PortalPage eyebrow="AI Receptionist / Call history" title="Call details">
      <AiCallLogDetail id={id} />
    </PortalPage>
  );
}
