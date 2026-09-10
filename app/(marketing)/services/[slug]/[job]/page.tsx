import { notFound } from "next/navigation";
import { JobDetail } from "@/components/marketplace/job-detail";
import { PublicFixedServiceDetail } from "@/components/marketplace/public-fixed-service-detail";
import { RelatedBrowse } from "@/components/marketplace/related-browse";
import { JsonLd } from "@/components/seo/json-ld";
import { getAllJobs, getJobRecord } from "@/lib/data/jobs";
import { getLocalKeywordPhrases, getLocalPageCopy, readPlaceFromSearch } from "@/lib/data/local-keywords";
import { firstSearchValue } from "@/lib/data/markets";
import { getJobStartingPrice } from "@/lib/data/provider-media";
import { getProvidersByCategoryId } from "@/lib/data/providers";
import { breadcrumbJsonLd, jobServiceJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";
import type { PageParams } from "@/lib/page-props";

export function generateStaticParams() {
  return getAllJobs().map(({ category, slug }) => ({
    slug: category.slug,
    job: slug,
  }));
}

export async function generateMetadata({
  params,
  searchParams,
}: PageParams<{ slug: string; job: string }>) {
  const { slug, job } = await params;
  const query = await searchParams;
  const record = getJobRecord(slug, job);
  if (!record) {
    return buildMetadata({
      title: "Service details",
      description: "View this fixed-price service offering.",
      path: `/services/${slug}/${job}`,
    });
  }

  const place = readPlaceFromSearch(query);
  const loc = firstSearchValue(query.loc);
  const local = getLocalPageCopy({
    category: record.category,
    job: record.job,
    ...place,
    loc,
  });

  return buildMetadata({
    title: local?.title ?? `${record.job} | ${record.category.name}`,
    description: local?.description ?? record.detail.description,
    path: `/services/${record.category.slug}/${record.slug}`,
    keywords: [
      ...getLocalKeywordPhrases({
        category: record.category,
        job: record.job,
        ...place,
        loc,
      }),
      record.job,
      record.category.name,
      `${record.job} near me`,
      "home services",
    ],
  });
}

export default async function JobDetailPage({
  params,
  searchParams,
}: PageParams<{ slug: string; job: string }>) {
  const { slug, job } = await params;
  const query = await searchParams;
  const record = getJobRecord(slug, job);

  // Live Fixed Service packages use the same URL shape with the service slug.
  if (!record) {
    if (!job?.trim()) notFound();
    return (
      <PublicFixedServiceDetail categorySlug={slug} serviceSlug={job} />
    );
  }

  const loc = firstSearchValue(query.loc);
  const zip = firstSearchValue(query.zip);
  const providers = getProvidersByCategoryId(record.category.id)
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || b.rating - a.rating)
    .slice(0, 4);

  return (
    <>
      <JsonLd
        data={[
          jobServiceJsonLd(record, getJobStartingPrice(record.category.id, record.job)),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Services", path: "/services" },
            { name: record.category.name, path: `/services/${record.category.slug}` },
            {
              name: record.job,
              path: `/services/${record.category.slug}/${record.slug}`,
            },
          ]),
        ]}
      />
      <JobDetail record={record} providers={providers} />
      <RelatedBrowse
        category={record.category}
        currentJob={record.job}
        basePath="/services"
        zip={zip || undefined}
        loc={loc || undefined}
      />
    </>
  );
}
