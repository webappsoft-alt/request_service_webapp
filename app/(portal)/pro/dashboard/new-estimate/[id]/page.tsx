import { NewEstimateWorkspaceView } from "@/components/portal/estimate-v2/new-estimate-workspace-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Estimate",
  "Estimate workspace for assessment and pricing.",
  "/pro/dashboard/new-estimate",
);

export default async function NewEstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NewEstimateWorkspaceView opportunityId={id} />;
}
