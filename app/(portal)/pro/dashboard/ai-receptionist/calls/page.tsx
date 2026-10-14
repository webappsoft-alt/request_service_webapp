import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AiCallHistory } from "@/components/ai-calling";
import { PortalPage } from "@/components/portal/portal-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      description="Every call your AI receptionist answered, including browser test calls. Open a call to read the full conversation and activity log."
      actions={
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/pro/dashboard/ai-receptionist">
            <ArrowLeft className="size-3.5" aria-hidden="true" /> Back to settings
          </Link>
        </Button>
      }
    >
      <Card className="rounded-xl border-border-soft">
        <CardContent className="pt-5">
          <AiCallHistory />
        </CardContent>
      </Card>
    </PortalPage>
  );
}
