import { ProfessionalMarketplace } from "@/components/marketplace/professional-marketplace";
import { RelatedBrowse } from "@/components/marketplace/related-browse";
import { WhyHireSection } from "@/components/marketplace/why-hire-section";
import { JsonLd } from "@/components/seo/json-ld";
import { getJobRecord } from "@/lib/data/jobs";
import { getLocalKeywordPhrases, getLocalPageCopy, readPlaceFromSearch } from "@/lib/data/local-keywords";
import { firstSearchValue, getExplorePlaceLabel } from "@/lib/data/markets";
import { directoryHref } from "@/lib/data/related-categories";
import { getServiceCategoryBySlug } from "@/lib/data/services";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";
import type { PageParams } from "@/lib/page-props";

export async function generateMetadata({ searchParams }: PageParams) {
  const params = await searchParams;
  const service = firstSearchValue(params.service);
  const jobSlug = firstSearchValue(params.job);
  const category = service ? getServiceCategoryBySlug(service) : undefined;
  const job = category && jobSlug ? getJobRecord(category.slug, jobSlug)?.job : undefined;
  const place = readPlaceFromSearch(params);
  const local = getLocalPageCopy({ category, job, ...place, loc: firstSearchValue(params.loc) });
  const placeLabel = getExplorePlaceLabel(place);

  return buildMetadata({
    title:
      local?.title ??
      (category ? `${category.name} Professionals Near You` : "Find a Home Service Professional"),
    description:
      local?.description ??
      (category
        ? `Compare local ${category.name.toLowerCase()} companies on the map. Filter by ZIP, rating, and license, then request an itemized estimate.`
        : "Search local service providers by category and ZIP code. View companies on the map, compare ratings and service areas, then request or book a professional."),
    path: category ? `/find-a-professional?service=${category.slug}` : "/find-a-professional",
    keywords: [
      ...getLocalKeywordPhrases({
        category,
        job,
        ...place,
        loc: firstSearchValue(params.loc) || firstSearchValue(params.location),
      }),
      category ? `${category.name} ${placeLabel}` : `home services ${placeLabel}`,
      "find a plumber",
      "HVAC near me",
      "licensed electrician",
      "local handyman",
      "home service professionals",
    ],
  });
}

export default async function FindProfessionalPage({ searchParams }: PageParams) {
  const params = await searchParams;
  const service = firstSearchValue(params.service);
  const zip = firstSearchValue(params.zip);
  const job = firstSearchValue(params.job);
  const loc = firstSearchValue(params.loc) || firstSearchValue(params.location);
  const ask = params.ask === "1" || params.ask === "true";
  const category = service ? getServiceCategoryBySlug(service) : undefined;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Find a Professional", path: "/find-a-professional" },
        ])}
      />
      <ProfessionalMarketplace
        ask={ask}
        category={category}
        zip={zip}
        location={loc}
        job={job}
        liveProfessionals
      />
      <WhyHireSection
        ctaHref={directoryHref("/request-service", {
          service: category?.slug,
          job: job || undefined,
          zip: zip || undefined,
          loc: loc || undefined,
        })}
        ctaLabel="Request a professional"
      />
      <RelatedBrowse
        category={category}
        currentJob={
          category && job ? getJobRecord(category.slug, job)?.job : undefined
        }
        basePath="/find-a-professional"
        zip={zip || undefined}
        loc={loc || undefined}
      />
    </>
  );
}
