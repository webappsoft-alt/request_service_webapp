import { BlogSection } from "@/components/home/blog-section";
import { HomeMotion } from "@/components/home/home-motion";
import { ProClose } from "@/components/pro/pro-close";
import { ProFaqSection } from "@/components/pro/pro-faq-section";
import { ProHero } from "@/components/pro/pro-hero";
import { ProLandingPlans } from "@/components/pro/pro-pricing-view";
import { ProProduct } from "@/components/pro/pro-product";
import { ProWorkflow } from "@/components/pro/pro-workflow";
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

export default function ProLandingPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "For Professionals", path: proPaths.home },
        ])}
      />
      <HomeMotion>
        <ProHero />
        <ProWorkflow />
        <ProProduct />

        <ProLandingPlans />

        <ProFaqSection />

        <BlogSection
          eyebrow="Pro Insights"
          title="Guides & insights for service businesses"
          description="Practical guides on winning jobs, managing client communications, estimating accurately, and growing your home service business."
          linkText="Explore pro articles"
          linkHref="/blog"
          limit={4}
        />

        <ProClose />
      </HomeMotion>
    </>
  );
}
