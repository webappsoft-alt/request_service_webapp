// import Link from "next/link";
// import { ArrowLeft } from "lucide-react";
import { AiCallTestHarness } from "@/components/ai-calling";
import { PortalPage } from "@/components/portal/portal-page";
// import { Button } from "@/components/ui/button";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Test AI Receptionist",
  "Talk to your AI receptionist from the browser before going live.",
  "/pro/dashboard/ai-receptionist/test",
);

export default function AiReceptionistTestPage() {
  return (
    <PortalPage
      backHref="/pro/dashboard/ai-receptionist"
      backLabel="Back to settings"
      eyebrow="AI Receptionist"
      title="Test call"
      description="Talk to your receptionist with your microphone. It uses the same speech, AI and voice pipeline as real calls, without placing a phone call."
      /* Client: "Back to settings" button → icon-only back arrow (backHref).
      actions={
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/pro/dashboard/ai-receptionist">
            <ArrowLeft className="size-3.5" aria-hidden="true" /> Back to settings
          </Link>
        </Button>
      } */
    >
      <AiCallTestHarness />
    </PortalPage>
  );
}
