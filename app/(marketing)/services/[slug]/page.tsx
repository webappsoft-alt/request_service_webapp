import { notFound } from "next/navigation";
import { RelatedBrowse } from "@/components/marketplace/related-browse";
import { ServicesDirectory } from "@/components/marketplace/services-directory";
import { WhyHireSection } from "@/components/marketplace/why-hire-section";
import { JsonLd } from "@/components/seo/json-ld";
import { getLocalKeywordPhrases, getLocalPageCopy, readPlaceFromSearch } from "@/lib/data/local-keywords";
import { firstSearchValue } from "@/lib/data/markets";
import { directoryHref } from "@/lib/data/related-categories";
import { getServiceCategoryBySlug, serviceCategories } from "@/lib/data/services";
import { breadcrumbJsonLd, serviceCategoryJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";
import type { PageParams } from "@/lib/page-props";

export function generateStaticParams() {
  return serviceCategories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: PageParams<{ slug: string }>) {
  const { slug } = await params;
  const query = await searchParams;
  const category = getServiceCategoryBySlug(slug);
  if (!category) {
    return buildMetadata({
      title: "Service not found",
      description: "That service category is not available.",
      path: `/services/${slug}`,
      index: false,
    });
  }
  const place = readPlaceFromSearch(query);
  const loc = firstSearchValue(query.loc);
  const local = getLocalPageCopy({ category, ...place, loc });

  return buildMetadata({
    title: local?.title ?? category.seoTitle,
    description: local?.description ?? category.seoDescription,
    path: `/services/${category.slug}`,
    keywords: [
      ...getLocalKeywordPhrases({ category, ...place, loc }),
      category.name,
      `${category.name} near me`,
      `local ${category.name.toLowerCase()}`,
      "home services",
    ],
  });
}

export default async function ServiceCategoryPage({
  params,
  searchParams,
}: PageParams<{ slug: string }>) {
  const { slug } = await params;
  const query = await searchParams;
  const category = getServiceCategoryBySlug(slug);
  if (!category) notFound();

  const loc = firstSearchValue(query.loc);
  const zip = firstSearchValue(query.zip);
  const job = firstSearchValue(query.job);

  return (
    <>
      <JsonLd
        data={[
          serviceCategoryJsonLd(category),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Services", path: "/services" },
            { name: category.name, path: `/services/${category.slug}` },
          ]),
        ]}
      />

      <ServicesDirectory
        initialCategory={category.slug}
        initialJob={job}
        initialZip={zip}
        initialLocation={loc}
      />
      <WhyHireSection
        ctaHref={directoryHref("/get-a-quote", {
          service: category.slug,
          job: job || undefined,
          zip: zip || undefined,
          loc: loc || undefined,
        })}
        ctaLabel="Get a written estimate"
      />
      <RelatedBrowse
        category={category}
        basePath="/services"
        zip={zip || undefined}
        loc={loc || undefined}
      />
    </>
  );
}
