import { AiCallingSettingsPanel } from "@/components/ai-calling";
import { PortalPage } from "@/components/portal/portal-page";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "AI Receptionist",
  "Let AI answer your business calls, capture leads, and transfer callers to your team.",
  "/pro/dashboard/ai-receptionist",
);

export default function AiReceptionistPage() {
  return (
    <PortalPage
      eyebrow="Office"
      title="AI Receptionist"
      description="Let AI answer your business calls, capture leads, and transfer callers to your team when needed."
    >
      {/* Sidebar sub-items now (AI Receptionist → Settings / Call history). Previous: <AiReceptionistTabs active="settings" /> */}
      <AiCallingSettingsPanel />
    </PortalPage>
  );
}
