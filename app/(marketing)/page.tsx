import { HomeCategoryFilterProvider } from "@/components/home/home-category-filter";
import { FeaturedProvidersSection } from "@/components/home/featured-providers-section";
import { HeroSection } from "@/components/home/hero-section";
// import { RedesignerSection } from "@/components/ai-redesigner/redesigner-section"; — moved to /ai-kitchen-redesign
import { CustomerFeatureTabs } from "@/components/home/customer-feature-tabs";
import { HomeSearchDock } from "@/components/home/home-search-dock";
import { HomeMotion } from "@/components/home/home-motion";
import { ServicesSection } from "@/components/home/services-section";
import { HomeFaqSection } from "@/components/home/faq-section";
import { PeaceOfMindTimeline } from "@/components/home-concepts/peace-of-mind-timeline";
import { CustomerReviewsSection } from "@/components/home-concepts/customer-reviews-section";
import { HireWithConfidenceSection } from "@/components/home-concepts/hire-with-confidence-section";
import { JsonLd } from "@/components/seo/json-ld";
import { DeferredHydration } from "@/components/shared/deferred-hydration";
import { fetchParentCategoriesForSeo } from "@/lib/data/public-categories-seo";
import { servicesItemListJsonLd } from "@/lib/json-ld";
import { buildMetadata, defaultKeywords } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Find Trusted Local Home Service Professionals",
  description:
    "Request Service connects homeowners with licensed local professionals and gives service businesses a complete platform for estimates, jobs, invoices, and payments.",
  path: "/",
  keywords: defaultKeywords,
});

/**
 * Home page — the client-approved layout (formerly the /home-v3 concept).
 * Flow: hero + search + Browse Services → peace of mind steps timeline → featured pros (two rows,
 * with logos) → hire with confidence → customer dashboard showcase → customer reviews → FAQ.
 * (Was "AI designer showcase": the before/after kitchen section now lives on /ai-kitchen-redesign,
 * linked from the navbar.)
 */
export default async function HomePage() {
  // Server-render the first "Browse services" tiles — they are the mobile LCP element.
  const initialCategories = await fetchParentCategoriesForSeo();

  return (
    <>
      <JsonLd data={[servicesItemListJsonLd()]} />

      {/* AI assistant (provider + floating launcher) is mounted site-wide in MarketingShell. */}
      <HomeCategoryFilterProvider>
        <HomeMotion>
          <HeroSection />
          <div>
            <HomeSearchDock />
            <ServicesSection initialParents={initialCategories} />
          </div>

          <PeaceOfMindTimeline />
          {/* Business profiles from the API + "See all professionals" link. */}
          <DeferredHydration>
            <FeaturedProvidersSection variant="homeowners" />
          </DeferredHydration>
          <HireWithConfidenceSection />

          {/* Below the fold: server HTML stays crawlable, hydration waits until it scrolls near. */}
          {/* Client: before/after kitchen section replaced by the animated customer dashboard
              features (estimates, change orders, invoices, chat, live tracking).
          <DeferredHydration>
            <RedesignerSection variant="showcase" />
          </DeferredHydration> */}
          <DeferredHydration>
            <CustomerFeatureTabs />
          </DeferredHydration>
          <CustomerReviewsSection />
          <DeferredHydration>
            <HomeFaqSection />
          </DeferredHydration>
        </HomeMotion>
      </HomeCategoryFilterProvider>
    </>
  );
}
