import Link from "next/link";
import { Container } from "@/components/layout/container";
import { RedesignerWizard } from "@/components/ai-redesigner/redesigner-wizard";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { AI_DESIGNER_PATH } from "@/lib/api/ai-redesigner-client";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "AI Kitchen & Bathroom Designer",
  description:
    "Upload a photo of your kitchen or bathroom, choose a style and finishes, and see it redesigned by AI — same layout, all-new look.",
  path: AI_DESIGNER_PATH,
});

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
          <RedesignerWizard />
        </Container>
      </section>
    </>
  );
}
