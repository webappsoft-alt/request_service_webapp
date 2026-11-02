import { HomeCategoryFilterProvider } from "@/components/home/home-category-filter";
import { FeaturedProvidersSection } from "@/components/home/featured-providers-section";
import { HeroSection } from "@/components/home/hero-section";
import { HomeSearchDock } from "@/components/home/home-search-dock";
import { HomeMotion } from "@/components/home/home-motion";
import { ServicesSection } from "@/components/home/services-section";
import { HomeFaqSection } from "@/components/home/faq-section";
import { WorkflowSection } from "@/components/home/workflow-section";
import { RedesignerSection } from "@/components/ai-redesigner/redesigner-section";
import { GeofenceTrackingSection } from "@/components/home-v1/geofence-tracking-section";
import {
  NextStepWays,
  ProofOfControl,
  ReadyToSolve,
  RsAiShowcase,
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
 * Flow (concept A board): three ways to start → RS AI panel → real pros → proof of control →
 * trust strip → how it works → AI redesigner → closing CTA → job updates → FAQ.
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
        <RsAiShowcase />
        <DeferredHydration>
          <FeaturedProvidersSection />
        </DeferredHydration>
        <ProofOfControl />
        <TrustStrip />
        <DeferredHydration>
          <WorkflowSection lift={false} edgeFade={false} />
        </DeferredHydration>
        <DeferredHydration>
          <RedesignerSection variant="showcase" tone="light" />
        </DeferredHydration>
        <ReadyToSolve />
        <DeferredHydration>
          <GeofenceTrackingSection tone="clean" />
        </DeferredHydration>
        <DeferredHydration>
          <HomeFaqSection />
        </DeferredHydration>
      </HomeMotion>
    </HomeCategoryFilterProvider>
  );
}
