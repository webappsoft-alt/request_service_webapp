import { HomeCategoryFilterProvider } from "@/components/home/home-category-filter";
import { FeaturedProvidersSection } from "@/components/home/featured-providers-section";
import { HeroSection } from "@/components/home/hero-section";
import { HomeSearchDock } from "@/components/home/home-search-dock";
import { HomeMotion } from "@/components/home/home-motion";
import { ServicesSection } from "@/components/home/services-section";
import { HomeFaqSection } from "@/components/home/faq-section";
import { PeaceOfMindTimeline } from "@/components/home-concepts/peace-of-mind-timeline";
import { CustomerReviewsSection } from "@/components/home-concepts/customer-reviews-section";
import { HireWithConfidenceSection } from "@/components/home-concepts/hire-with-confidence-section";
import { RedesignerSection } from "@/components/ai-redesigner/redesigner-section";
// Hidden for now (client feedback); see the commented sections below.
// import {
//   NextStepWays,
//   ProofOfControl,
//   ReadyToSolve,
//   TrustStrip,
// } from "@/components/home-concepts/next-step-layout";
import { DeferredHydration } from "@/components/shared/deferred-hydration";
import { fetchParentCategoriesForSeo } from "@/lib/data/public-categories-seo";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Home concept 3 (next step)",
  description: "Client review concept for the Request Service home page.",
  path: "/home-v3",
  index: false,
  follow: false,
});

/**
 * Keeps the complete v1 header, hero, search, and Browse Services composition unchanged.
 * Flow: peace of mind steps timeline → real pros (two rows, with logos) → hire with confidence → AI designer (v1's dark version) → customer reviews → FAQ.
 * "Three ways to start", proof of control, trust strip, and closing CTA are commented out for now.
 */
export default async function HomeV3Page() {
  const initialCategories = await fetchParentCategoriesForSeo();

  return (
    <HomeCategoryFilterProvider>
      <HomeMotion>
        <HeroSection />
        <div>
          <HomeSearchDock />
          <ServicesSection initialParents={initialCategories} />
        </div>

        {/* <NextStepWays /> */}
        <PeaceOfMindTimeline />
        <DeferredHydration>
          <FeaturedProvidersSection variant="homeowners" />
        </DeferredHydration>
        <HireWithConfidenceSection />
        <DeferredHydration>
          <RedesignerSection variant="showcase" />
        </DeferredHydration>
        {/* <ProofOfControl /> */}
        {/* <TrustStrip /> */}
        {/* <ReadyToSolve /> */}
        <CustomerReviewsSection />
        <DeferredHydration>
          <HomeFaqSection />
        </DeferredHydration>
      </HomeMotion>
    </HomeCategoryFilterProvider>
  );
}
