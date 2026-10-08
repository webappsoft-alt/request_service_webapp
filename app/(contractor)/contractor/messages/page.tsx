import { Suspense } from "react";
import { ContractorMessagesView } from "@/components/contractor/views/contractor-messages-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Messages",
  "Chat with the office about your assigned jobs and payouts.",
  "/contractor/messages",
);

export default function ContractorMessagesPage() {
  return (
    <Suspense>
      <ContractorMessagesView />
    </Suspense>
  );
}
