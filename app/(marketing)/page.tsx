import { HomeCategoryFilterProvider } from "@/components/home/home-category-filter";
import { FeaturedProvidersSection } from "@/components/home/featured-providers-section";
import { CustomerTrustSection } from "@/components/home/customer-trust-section";
// Customer journey ("From the first question to the final invoice") — parked; kept for restore.
// import { CustomerJourneySection } from "@/components/home/customer-journey-section";
import { CustomerAssuranceSection } from "@/components/home/customer-assurance-section";
import { HeroSection } from "@/components/home/hero-section";
import { HomeSearchDock } from "@/components/home/home-search-dock";
import { HomeMotion } from "@/components/home/home-motion";
import { ServicesSection } from "@/components/home/services-section";
import { HomeFaqSection } from "@/components/home/faq-section";
import { WorkflowSection } from "@/components/home/workflow-section";
import { JsonLd } from "@/components/seo/json-ld";
import { servicesItemListJsonLd } from "@/lib/json-ld";
import { buildMetadata, defaultKeywords } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Find Trusted Local Home Service Professionals",
  description:
    "Request Service connects homeowners with licensed local professionals and gives service businesses a complete platform for estimates, jobs, invoices, and payments.",
  path: "/",
  keywords: defaultKeywords,
});

export default function HomePage() {
  return (
    <>
      <JsonLd data={[servicesItemListJsonLd()]} />

      <HomeCategoryFilterProvider>
        <HomeMotion>
          <HeroSection />
          <div>
            <HomeSearchDock />
            <ServicesSection />
          </div>

          <CustomerTrustSection />
          {/* 4 business profiles from the API + "See all professionals" link. */}
          <FeaturedProvidersSection />
          {/*
            Customer journey section parked — restore by swapping it back in:
            <CustomerJourneySection />
          */}
          <CustomerAssuranceSection />

          <WorkflowSection />
          <HomeFaqSection />
        </HomeMotion>
      </HomeCategoryFilterProvider>
    </>
  );
}
