import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { RedesignerWizard } from "@/components/ai-redesigner/redesigner-wizard";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { AI_DESIGNER_LIVE, AI_DESIGNER_PATH } from "@/lib/api/ai-redesigner-client";
import { buildMetadata } from "@/lib/seo";

export const metadata = {
  ...buildMetadata({
  title: "AI Kitchen & Bathroom Designer",
  description:
    "Upload a photo of your kitchen or bathroom, choose a style and finishes, and see it redesigned by AI — same layout, all-new look.",
  path: AI_DESIGNER_PATH,
  }),
  // Keep the placeholder out of search results until launch.
  ...(AI_DESIGNER_LIVE ? {} : { robots: { index: false, follow: true } }),
};

function ComingSoon() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl bg-muted/40 px-6 py-16 text-center md:py-24">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="size-7" aria-hidden="true" />
      </span>
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">AI Kitchen &amp; Bath Redesigner is coming soon</h1>
      <p className="max-w-lg text-sm leading-7 text-muted-foreground md:text-base">
        Upload a photo, pick a style and finishes, and see your room redesigned. We&apos;re putting the finishing touches on it.
      </p>
      <Button size="lg" asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}

export default function AiKitchenBathDesignerPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "AI Kitchen & Bathroom Designer", path: AI_DESIGNER_PATH },
        ])}
      />
      <section className="py-6 md:py-10">
        <Container className="flex flex-col gap-5">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="transition-colors hover:text-primary">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="font-medium text-foreground" aria-current="page">
                AI Designer
              </li>
            </ol>
          </nav>
          {AI_DESIGNER_LIVE ? <RedesignerWizard /> : <ComingSoon />}
        </Container>
      </section>
    </>
  );
}
