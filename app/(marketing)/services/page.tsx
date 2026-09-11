import { RelatedBrowse } from "@/components/marketplace/related-browse";
import { ServicesDirectory } from "@/components/marketplace/services-directory";
import { WhyHireSection } from "@/components/marketplace/why-hire-section";
import { JsonLd } from "@/components/seo/json-ld";
import { getJobRecord } from "@/lib/data/jobs";
import { getLocalKeywordPhrases, getLocalPageCopy, readPlaceFromSearch } from "@/lib/data/local-keywords";
import { firstSearchValue } from "@/lib/data/markets";
import { directoryHref } from "@/lib/data/related-categories";
import { getServiceCategoryBySlug } from "@/lib/data/services";
import { breadcrumbJsonLd, servicesItemListJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";
import type { PageParams } from "@/lib/page-props";

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

  return buildMetadata({
    title: local?.title ?? "Home Services Directory",
    description:
      local?.description ??
      "Browse plumbing, HVAC, electrical, cleaning, roofing, and more. Pick a category to see common jobs, starting prices, and the companies that offer them.",
    path: "/services",
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
  const loc = firstSearchValue(params.loc);
  const zip = firstSearchValue(params.zip);
  const job = firstSearchValue(params.job);

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
    </>
  );
}
