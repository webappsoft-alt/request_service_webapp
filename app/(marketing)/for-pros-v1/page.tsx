import { HomeMotion } from "@/components/home/home-motion";
import { ProClose } from "@/components/pro/pro-close";
import { ProFaqSection } from "@/components/pro/pro-faq-section";
import { ProHero } from "@/components/pro/pro-hero";
import { ProProduct } from "@/components/pro/pro-product";
import { ProShowcase } from "@/components/pro-v1/pro-showcase";
import { ProAiReceptionist } from "@/components/pro-v1/pro-ai-receptionist";
import { ProContractorPortal, ProTechnicianPortal } from "@/components/pro-v1/pro-field-portals";
import { ProPipelineSection } from "@/components/pro-v1/pro-pipeline-section";
import { ProTeamTimeSection } from "@/components/pro-v1/pro-office-sections";
import { ProPricingV1 } from "@/components/pro-v1/pro-pricing-v1";
import { buildMetadata } from "@/lib/seo";

/**
 * Pro landing layout prototype (client review). Same hero copy, FAQ, and closing CTA as
 * /for-pros. Below the hero, in order: the CRM portal showcase, the AI receptionist, the team &
 * field portals, the pipeline & workflow, pricing, then FAQ and the closing CTA.
 * Not indexed; /for-pros is unchanged.
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
      {/* 1 · Value proposition + CTA */}
      <ProHero withScreenshot={false} />

      {/*
        Sections alternate soft grey (bg-muted/50) and white on the shared section spacing:
        showcase (grey) · AI (white) · technician (grey) · contractor (white) · team (grey) ·
        pipeline (white) · workflow (grey) · pricing (white) · FAQ (grey).
      */}

      {/* 2 · CRM portal showcase: Leads · Estimates · Schedule · Jobs · Invoices · Messages (real captures) */}
      <ProShowcase />

      {/* 3 · AI Business Receptionist */}
      <ProAiReceptionist />

      {/* 4 · Team & field portals: technicians (clock-in), contractors, then dispatch / timesheets / live tracking */}
      <ProTechnicianPortal />
      <ProContractorPortal />
      <ProTeamTimeSection />

      {/* 5 · Pipeline & workflow: the board, then the lead → estimate → job → invoice flow and trades */}
      <ProPipelineSection />
      {/* The shared sections use "tight" spacing; the wrapper pads them up to the page rhythm (4.5rem / 6rem). */}
      <div className="bg-muted/50 py-8 md:py-12">
        <ProProduct />
      </div>

      {/* 6 · Transparent pricing */}
      <ProPricingV1 />

      {/* 7 · FAQ and final CTA */}
      <div className="bg-muted/50 py-8 md:py-12">
        <ProFaqSection />
      </div>
      <div className="pt-14 md:pt-20">
        <ProClose />
      </div>
    </HomeMotion>
  );
}
