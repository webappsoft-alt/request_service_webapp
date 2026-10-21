import { RelatedBrowse } from "@/components/marketplace/related-browse";
import { ServicesDirectory } from "@/components/marketplace/services-directory";
import { WhyHireSection } from "@/components/marketplace/why-hire-section";
import { JsonLd } from "@/components/seo/json-ld";
import { ProRecruitCta } from "@/components/seo/pro-recruit-cta";
import { getJobRecord } from "@/lib/data/jobs";
import { getLocalKeywordPhrases, getLocalPageCopy, readPlaceFromSearch } from "@/lib/data/local-keywords";
import { findLocationCity } from "@/lib/data/locations";
import { firstSearchValue } from "@/lib/data/markets";
import { publicPaths } from "@/lib/public-paths";
import { directoryHref } from "@/lib/data/related-categories";
import { getServiceCategoryBySlug } from "@/lib/data/services";
import { breadcrumbJsonLd, servicesItemListJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";
import type { PageParams } from "@/lib/page-props";
import { usStateName } from "@/lib/data/us-states";

export async function generateMetadata({ searchParams }: PageParams) {
  const params = await searchParams;
  const service = firstSearchValue(params.service) || firstSearchValue(params.category);
  const jobSlug = firstSearchValue(params.job);
  const category = service ? getServiceCategoryBySlug(service) : undefined;
  const job = category && jobSlug ? getJobRecord(category.slug, jobSlug)?.job : undefined;
  const place = readPlaceFromSearch(params);
  const local = getLocalPageCopy({
    category,
    job,
    ...place,
    loc: firstSearchValue(params.loc),
  });

  // Canonical: the clean directory URL for this filter (/locations/co/denver/plumbing,
  // /services/plumbing, …) so ?city=&state=&service= variants don't compete with it.
  const cityPage = findLocationCity(firstSearchValue(params.city), firstSearchValue(params.state));
  const jobRecord = category && jobSlug ? getJobRecord(category.slug, jobSlug) : undefined;
  const canonical = cityPage
    ? category
      ? jobRecord
        ? publicPaths.locationSubService(cityPage.state.slug, cityPage.slug, category.slug, jobRecord.slug)
        : publicPaths.locationService(cityPage.state.slug, cityPage.slug, category.slug)
      : publicPaths.locationCity(cityPage.state.slug, cityPage.slug)
    : category
      ? jobRecord
        ? publicPaths.subService(category.slug, jobRecord.slug)
        : publicPaths.service(category.slug)
      : publicPaths.services;

  return buildMetadata({
    title: local?.title ?? "Home Services Directory",
    description:
      local?.description ??
      "Browse plumbing, HVAC, electrical, cleaning, roofing, and more. Pick a category to see common jobs, starting prices, and the companies that offer them.",
    path: canonical,
    keywords: [
      ...getLocalKeywordPhrases({
        category,
        job,
        ...place,
        loc: firstSearchValue(params.loc),
      }),
      "home services directory",
      "plumbing",
      "HVAC",
      "electrical",
      "handyman",
      "house cleaning",
      "roofing",
    ],
  });
}

export default async function ServicesPage({ searchParams }: PageParams) {
  const params = await searchParams;
  const selectedSlug =
    firstSearchValue(params.service) || firstSearchValue(params.category);
  const selectedCategory = selectedSlug
    ? getServiceCategoryBySlug(selectedSlug)
    : undefined;
  const zip = firstSearchValue(params.zip);
  const job = firstSearchValue(params.job);
  // Location filter: ?city=Los Angeles&state=CA or ?state=CA (zip / loc kept for older links).
  const city = firstSearchValue(params.city);
  const state = firstSearchValue(params.state);
  const loc =
    firstSearchValue(params.loc) ||
    (state ? (city ? `${city}, ${state}` : usStateName(state) || state) : "");

  return (
    <>
      <JsonLd
        data={[
          servicesItemListJsonLd(),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Services", path: "/services" },
          ]),
        ]}
      />
      <ServicesDirectory
        initialQuery={firstSearchValue(params.q)}
        initialCategory={selectedSlug || ""}
        initialJob={job}
        initialZip={zip}
        initialLocation={loc}
        initialCity={city}
        initialState={state}
        initialProviderId={firstSearchValue(params.provider)}
        initialProviderName={firstSearchValue(params.providerName)}
        initialFocus={firstSearchValue(params.focus)}
      />
      <WhyHireSection
        ctaHref={directoryHref("/get-a-quote", {
          service: selectedCategory?.slug,
          job: job || undefined,
          zip: zip || undefined,
          loc: loc || undefined,
        })}
        ctaLabel="Get a written estimate"
      />
      <RelatedBrowse
        category={selectedCategory}
        currentJob={
          selectedCategory && job
            ? getJobRecord(selectedCategory.slug, job)?.job
            : undefined
        }
        basePath="/services"
        zip={zip || undefined}
        loc={loc || undefined}
      />
      <ProRecruitCta place={city || usStateName(state) || undefined} />
    </>
  );
}
