import { HomeMotion } from "@/components/home/home-motion";
import { ProClose } from "@/components/pro/pro-close";
import { ProFaqSection } from "@/components/pro/pro-faq-section";
import { ProHero } from "@/components/pro/pro-hero";
import { ProProduct } from "@/components/pro/pro-product";
import { ProFeatureTabs } from "@/components/pro-v1/pro-feature-tabs";
import { ProPipelineSection } from "@/components/pro-v1/pro-pipeline-section";
import { ProPricingV1 } from "@/components/pro-v1/pro-pricing-v1";
import { buildMetadata } from "@/lib/seo";

/**
 * Pro landing layout prototype (client review). Same hero copy, FAQ, and closing CTA as
 * /for-pros. Below the hero, in order: the feature tabs, the "Get started" band, the pipeline &
 * workflow, pricing, then FAQ. Not indexed; /for-pros is unchanged.
 */
export const metadata = buildMetadata({
  title: "For Pros (layout preview)",
  description: "Preview of the redesigned pro landing page.",
  path: "/for-pros-v1",
  index: false,
  follow: false,
});

export default function ProLandingV1Page() {
  return (
    <HomeMotion>
      {/* .pros-v1 tightens section spacing on this page only (globals.css). */}
      <div className="pros-v1">
        {/* 1 · Value proposition + CTA */}
        <ProHero withScreenshot={false} />

        {/*
        Sections alternate soft grey (bg-muted/50) and white on the shared section spacing:
        feature tabs (white) · pipeline (white) · workflow (grey) · pricing (white) · FAQ (grey).
      */}

        {/* 2 · Feature tabs: one panel of copy + mock-up per feature */}
        <ProFeatureTabs />

        {/* 3 · "Get started": customer quote + "Open your account today", full-width brand band. */}
        <ProClose band />

        {/* 4 · Pipeline & workflow: the board, then the lead → estimate → job → invoice flow and trades */}
        <ProPipelineSection />
        <div className="bg-muted/50">
          <ProProduct compact />
        </div>

        {/* 5 · Transparent pricing */}
        <ProPricingV1 />

        {/* 6 · FAQ */}
        <div className="bg-muted/50">
          <ProFaqSection />
        </div>
      </div>
    </HomeMotion>
  );
}
