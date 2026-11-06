import { HomeMotion } from "@/components/home/home-motion";
import { ProClose } from "@/components/pro/pro-close";
import { ProFaqSection } from "@/components/pro/pro-faq-section";
import { ProHero } from "@/components/pro/pro-hero";
import { ProProduct } from "@/components/pro/pro-product";
import { ProRegionalLinks } from "@/components/pro/pro-seo-landing";
import { ProFeatureTabs } from "@/components/pro-v1/pro-feature-tabs";
import { ProPipelineSection } from "@/components/pro-v1/pro-pipeline-section";
import { ProPricingV1 } from "@/components/pro-v1/pro-pricing-v1";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { proPaths } from "@/lib/pro-paths";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Join as a Pro | Business Software for Home Service Companies",
  description:
    "Put your company in front of local homeowners, then run requests, estimates, jobs, invoices, and your crew from one portal. No commission on the work you win.",
  path: proPaths.home,
  keywords: [
    "join as a pro",
    "service business software",
    "contractor estimates",
    "field service management",
    "home service CRM",
    "invoice software for contractors",
  ],
});

/**
 * Pro landing page — the client-approved layout (formerly the /for-pros-v1 preview).
 * Below the hero, in order: feature tabs, the "Get started" band, pipeline & workflow, pricing,
 * regional directory links, then FAQ.
 */
export default function ProLandingPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "For Pros", path: proPaths.home },
        ])}
      />
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

          {/* 6 · Internal links to the city / trade directories (SEO crawl path) */}
          <ProRegionalLinks />

          {/* 7 · FAQ */}
          <div className="bg-muted/50">
            <ProFaqSection />
          </div>
        </div>
      </HomeMotion>
    </>
  );
}
