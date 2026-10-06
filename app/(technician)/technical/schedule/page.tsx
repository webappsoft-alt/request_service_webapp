import { TechnicianScheduleView } from "@/components/technician/views/technician-schedule-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata("My schedule", "Visits booked for you.", "/technical/schedule");

export default function TechnicianSchedulePage() {
  return <TechnicianScheduleView />;
}
