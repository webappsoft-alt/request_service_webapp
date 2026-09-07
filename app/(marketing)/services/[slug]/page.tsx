import { notFound } from "next/navigation";
import { CategoryExplorer } from "@/components/marketplace/category-explorer";
import { RelatedBrowse } from "@/components/marketplace/related-browse";
import { JsonLd } from "@/components/seo/json-ld";
import { getLocalKeywordPhrases, getLocalPageCopy, readPlaceFromSearch } from "@/lib/data/local-keywords";
import { firstSearchValue } from "@/lib/data/markets";
import { getProvidersByCategoryId } from "@/lib/data/providers";
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

  const matchingProviders = getProvidersByCategoryId(category.id);
  const loc = firstSearchValue(query.loc);
  const zip = firstSearchValue(query.zip);

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

      <CategoryExplorer
        category={category}
        providers={matchingProviders}
        initialAddress={loc || zip}
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
