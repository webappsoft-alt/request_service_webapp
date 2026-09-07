import { TeamMemberView } from "@/components/portal/views/team-view";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Team member",
  "Employee file: settings, availability, pay, schedule, and assigned work.",
  "/pro/dashboard/team",
);

export default async function TeamMemberPage({ params }: PageParams<{ id: string }>) {
  const { id } = await params;
  return <TeamMemberView id={id} />;
}
