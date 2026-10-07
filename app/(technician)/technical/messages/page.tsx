import { Suspense } from "react";
import { TechnicianMessagesView } from "@/components/technician/views/technician-messages-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Messages",
  "Chat with the office about your jobs, estimates and pay.",
  "/technical/messages",
);

export default function TechnicianMessagesPage() {
  return (
    <Suspense>
      <TechnicianMessagesView />
    </Suspense>
  );
}
