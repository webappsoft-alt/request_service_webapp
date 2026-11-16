// Previous: the call list (AiCallHistory) under its own "Call history" header with a "Back to
// settings" button. Now the AI Receptionist page's Call history tab, as a table.
import { AiCallHistoryTable } from "@/components/ai-calling";
import { PortalPage } from "@/components/portal/portal-page";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "AI Call History",
  "Every call your AI receptionist answered, with the full conversation.",
  "/pro/dashboard/ai-receptionist/calls",
);

export default function AiCallHistoryPage() {
  return (
    <PortalPage
      eyebrow="AI Receptionist"
      title="Call history"
      description="Every call your AI receptionist answered, including browser test calls. Click a call to see what was captured and the full conversation."
    >
      {/* Sidebar sub-items now (AI Receptionist → Settings / Call history). Previous: <AiReceptionistTabs active="calls" /> */}
      {/* Table straight on the page, like Leads (search, filter, export). Previous: wrapped in a
      bordered card (looked like a box inside a box). */}
      <AiCallHistoryTable />
    </PortalPage>
  );
}
