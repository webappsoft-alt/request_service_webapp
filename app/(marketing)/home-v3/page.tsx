import { HomeCategoryFilterProvider } from "@/components/home/home-category-filter";
import { FeaturedProvidersSection } from "@/components/home/featured-providers-section";
import { HeroSection } from "@/components/home/hero-section";
import { HomeSearchDock } from "@/components/home/home-search-dock";
import { HomeMotion } from "@/components/home/home-motion";
import { ServicesSection } from "@/components/home/services-section";
import { HomeFaqSection } from "@/components/home/faq-section";
import { PeaceOfMindList } from "@/components/home-concepts/peace-of-mind-list";
import { RedesignerSection } from "@/components/ai-redesigner/redesigner-section";
import {
  NextStepWays,
  ProofOfControl,
  ReadyToSolve,
  TrustStrip,
} from "@/components/home-concepts/next-step-layout";
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
 * Flow: three ways to start → real pros (two rows) → peace of mind list → AI designer (v1's dark
 * version) → proof of control → trust strip → closing CTA → FAQ.
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

        <NextStepWays />
        <DeferredHydration>
          <FeaturedProvidersSection variant="homeowners" />
        </DeferredHydration>
        <PeaceOfMindList>
          <DeferredHydration>
            <RedesignerSection variant="showcase" />
          </DeferredHydration>
          <ProofOfControl />
        </PeaceOfMindList>
        <TrustStrip />
        <ReadyToSolve />
        <DeferredHydration>
          <HomeFaqSection />
        </DeferredHydration>
      </HomeMotion>
    </HomeCategoryFilterProvider>
  );
}
