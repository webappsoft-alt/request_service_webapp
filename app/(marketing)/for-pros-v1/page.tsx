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
import { ProPortalIndex } from "@/components/pro-v1/pro-portal-index";
import { ProPricingV1 } from "@/components/pro-v1/pro-pricing-v1";
import { buildMetadata } from "@/lib/seo";

/**
 * Pro landing layout prototype (client review). Same hero copy, FAQ, and closing CTA as
 * /for-pros; the floating screenshots and alternating screenshot blocks are replaced by one
 * tabbed showcase, a team-dashboards panel, a text index of the rest of the portal, and a
 * cleaner pricing panel. Not indexed; /for-pros is unchanged.
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
      <ProHero withScreenshot={false} />
      {/* Leads · Estimates · Schedule · Jobs · Invoices · Messages — real captures, right under the hero. */}
      <ProShowcase />
      {/* Sections alternate white and soft neutral (bg-muted/50) — no dark bands or patterns. */}
      {/* The headline feature: the live call preview. */}
      <ProAiReceptionist />
      {/* Lead → estimate → job → invoice rail + trades */}
      <div className="bg-muted/50">
        <ProProduct />
      </div>
      {/* The field logins: technician portal, then contractor portal. */}
      <ProTechnicianPortal />
      <ProContractorPortal />
      {/* The Pipeline board, then People in the real pro sidebar frame. */}
      <ProPipelineSection />
      <ProTeamTimeSection />
      <ProPortalIndex />
      <ProPricingV1 />
      <ProFaqSection />
      <ProClose />
    </HomeMotion>
  );
}
