import { TechnicianTimeView } from "@/components/technician/views/technician-time-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Time tracking",
  "Your clock-in / clock-out history, hours, and pay.",
  "/technical/time-tracking",
);

export default function TechnicianTimePage() {
  return <TechnicianTimeView />;
}
