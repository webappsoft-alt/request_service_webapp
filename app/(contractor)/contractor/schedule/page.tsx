import { ContractorScheduleView } from "@/components/contractor/views/contractor-schedule-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Schedule",
  "Your assigned jobs by day with the office's time windows.",
  "/contractor/schedule",
);

export default function ContractorSchedulePage() {
  return <ContractorScheduleView />;
}
