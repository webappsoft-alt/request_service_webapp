import { HomeCategoryFilterProvider } from "@/components/home/home-category-filter";
import { FeaturedProvidersSection } from "@/components/home/featured-providers-section";
import { HeroSection } from "@/components/home/hero-section";
import { RedesignerSection } from "@/components/ai-redesigner/redesigner-section";
import { HomeSearchDock } from "@/components/home/home-search-dock";
import { HomeMotion } from "@/components/home/home-motion";
import { ServicesSection } from "@/components/home/services-section";
import { HomeFaqSection } from "@/components/home/faq-section";
import { WorkflowSection } from "@/components/home/workflow-section";
import { HowItWorksTimeline } from "@/components/home-v1/how-it-works-timeline";
import { AssuranceSplit } from "@/components/home-v1/assurance-split";
import { AiReceptionistSection } from "@/components/home-v1/ai-receptionist-section";
import { GeofenceTrackingSection } from "@/components/home-v1/geofence-tracking-section";
import { DeferredHydration } from "@/components/shared/deferred-hydration";
import { fetchParentCategoriesForSeo } from "@/lib/data/public-categories-seo";
import { buildMetadata } from "@/lib/seo";

/**
 * Home page layout prototype (client review). Everything down to "Browse services" is exactly
 * "/"; the card-grid sections from "Built for homeowners" on are rebuilt with varied layouts.
 * Not indexed; "/" is unchanged.
 */
export const metadata = buildMetadata({
  title: "Home (layout preview)",
  description: "Preview of the redesigned home page layout.",
  path: "/home-v1",
  index: false,
  follow: false,
});

export default async function HomeV1Page() {
  const initialCategories = await fetchParentCategoriesForSeo();

  return (
    <HomeCategoryFilterProvider>
      <HomeMotion>
        <HeroSection />
        <div>
          <HomeSearchDock />
          <ServicesSection initialParents={initialCategories} />
        </div>

        <HowItWorksTimeline />

        <DeferredHydration>
          <FeaturedProvidersSection />
        </DeferredHydration>

        <DeferredHydration>
          <AiReceptionistSection />
        </DeferredHydration>

        <AssuranceSplit />

        <DeferredHydration>
          <WorkflowSection />
        </DeferredHydration>
        <DeferredHydration>
          <RedesignerSection variant="showcase" />
        </DeferredHydration>
        <DeferredHydration>
          <HomeFaqSection />
        </DeferredHydration>
        <DeferredHydration>
          <GeofenceTrackingSection />
        </DeferredHydration>
      </HomeMotion>
    </HomeCategoryFilterProvider>
  );
}
