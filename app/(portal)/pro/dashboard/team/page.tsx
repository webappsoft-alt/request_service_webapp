import { TeamView } from "@/components/portal/views/team-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Team",
  "Add technicians and estimators, then assign them to jobs and estimate visits.",
  "/pro/dashboard/team",
);

export default function TeamPage() {
  return <TeamView />;
}
