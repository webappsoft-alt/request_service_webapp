import { MessagesView } from "@/components/portal/views/messages-view";
import { PortalSuspense } from "@/components/portal/portal-suspense";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Messages",
  "Discuss website chats and quote requests with customers.",
  "/pro/dashboard/messages",
);

export default function MessagesPage() {
  return (
    <PortalSuspense>
      <MessagesView />
    </PortalSuspense>
  );
}
