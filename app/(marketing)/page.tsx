import { BlogSection } from "@/components/home/blog-section";
import { HomeCategoryFilterProvider } from "@/components/home/home-category-filter";
import { HeroSection } from "@/components/home/hero-section";
import { HomeSearchDock } from "@/components/home/home-search-dock";
import { HomeMotion } from "@/components/home/home-motion";
import { ServicesSection } from "@/components/home/services-section";
import { HomeFaqSection } from "@/components/home/faq-section";
import { WorkflowSection } from "@/components/home/workflow-section";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { ProviderCard } from "@/components/shared/provider-card";
import { JsonLd } from "@/components/seo/json-ld";
import { getFeaturedProviders } from "@/lib/data/providers";
import { servicesItemListJsonLd } from "@/lib/json-ld";
import { buildMetadata, defaultKeywords } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Find Trusted Local Home Service Professionals",
  description:
    "Request Services connects homeowners with licensed local professionals and gives service businesses a complete platform for estimates, jobs, invoices, and payments.",
  path: "/",
  keywords: defaultKeywords,
});

export default function HomePage() {
  const featuredProviders = getFeaturedProviders();

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

        <Section tone="muted" density="tight">
          <Container className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-2">
                <p className="eyebrow text-muted-foreground">Featured providers</p>
                <h2 className="text-3xl font-semibold md:text-[2.5rem]">Pros you can compare on more than stars</h2>
              </div>
              <Link
                href="/find-a-professional"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand transition-colors hover:text-foreground"
              >
                See all professionals
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
            <div data-stagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {featuredProviders.slice(0, 8).map((provider, index) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  visual
                  hideCredentials={index === 1 || index === 2}
                />
              ))}
            </div>
          </Container>
        </Section>

        <WorkflowSection />
        <HomeFaqSection />
        <BlogSection />
        </HomeMotion>
      </HomeCategoryFilterProvider>
    </>
  );
}
