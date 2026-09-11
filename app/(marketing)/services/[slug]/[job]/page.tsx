import { notFound } from "next/navigation";
import { JobDetail } from "@/components/marketplace/job-detail";
import { PublicFixedServiceDetail } from "@/components/marketplace/public-fixed-service-detail";
import { RelatedBrowse } from "@/components/marketplace/related-browse";
import { JsonLd } from "@/components/seo/json-ld";
import { getAllJobs, getJobRecord } from "@/lib/data/jobs";
import {
  buildPublicFixedServiceDescription,
  fetchPublicFixedServiceForSeo,
  resolvePublicFixedServiceOgImage,
} from "@/lib/data/public-fixed-service-seo";
import { getLocalKeywordPhrases, getLocalPageCopy, readPlaceFromSearch } from "@/lib/data/local-keywords";
import { firstSearchValue } from "@/lib/data/markets";
import { getJobStartingPrice } from "@/lib/data/provider-media";
import { getProvidersByCategoryId } from "@/lib/data/providers";
import { breadcrumbJsonLd, jobServiceJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";
import { siteConfig, absoluteUrl } from "@/lib/site";
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
    const live = await fetchPublicFixedServiceForSeo(job);
    const path = `/services/${slug}/${job}`;
    if (!live) {
      return buildMetadata({
        title: "Service details",
        description: "View this fixed-price service offering.",
        path,
      });
    }

    const title = live.categoryName
      ? `${live.servicesName} | ${live.categoryName}`
      : live.servicesName;
    const description = buildPublicFixedServiceDescription(live);
    const images = resolvePublicFixedServiceOgImage(live);

    return buildMetadata({
      title,
      description,
      path,
      keywords: [
        live.servicesName,
        live.categoryName || "",
        live.providerName || "",
        "fixed price service",
        "home services",
        `${live.servicesName} near me`,
      ].filter(Boolean),
      images,
      ogType: "website",
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
    images: record.category.image
      ? [
          record.category.image.startsWith("http")
            ? record.category.image
            : absoluteUrl(record.category.image),
        ]
      : undefined,
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
    const live = await fetchPublicFixedServiceForSeo(job);
    const path = `/services/${slug}/${job}`;
    return (
      <>
        {live ? (
          <JsonLd
            data={[
              {
                "@context": "https://schema.org",
                "@type": "Service",
                name: live.servicesName,
                description: buildPublicFixedServiceDescription(live),
                serviceType: live.categoryName || "Home service",
                url: absoluteUrl(path),
                image: resolvePublicFixedServiceOgImage(live),
                provider: live.providerName
                  ? {
                      "@type": "Organization",
                      name: live.providerName,
                    }
                  : {
                      "@type": "Organization",
                      name: siteConfig.name,
                    },
                ...(live.price > 0
                  ? {
                      offers: {
                        "@type": "Offer",
                        price: live.price,
                        priceCurrency: "USD",
                      },
                    }
                  : {}),
                areaServed: {
                  "@type": "Country",
                  name: "United States",
                },
              },
              breadcrumbJsonLd([
                { name: "Home", path: "/" },
                { name: "Services", path: "/services" },
                {
                  name: live.categoryName || "Category",
                  path: `/services/${slug}`,
                },
                { name: live.servicesName, path },
              ]),
            ]}
          />
        ) : null}
        <PublicFixedServiceDetail categorySlug={slug} serviceSlug={job} />
      </>
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
