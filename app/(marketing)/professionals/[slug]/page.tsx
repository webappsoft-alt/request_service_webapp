import { ProviderProfile } from "@/components/marketplace/provider-profile";
import { PublicProfessionalDetail } from "@/components/marketplace/public-professional-detail";
import { JsonLd } from "@/components/seo/json-ld";
import { getLocalKeywordPhrases } from "@/lib/data/local-keywords";
import { getStartingPrice } from "@/lib/data/provider-media";
import { getAllProviders, getProviderBySlug } from "@/lib/data/providers";
import { getServiceCategoryById } from "@/lib/data/services";
import { formatStartingPrice } from "@/lib/format";
import { breadcrumbJsonLd, providerJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";
import type { PageParams } from "@/lib/page-props";

export function generateStaticParams() {
  return getAllProviders().map((provider) => ({ slug: provider.slug }));
}

export async function generateMetadata({ params }: PageParams<{ slug: string }>) {
  const { slug } = await params;
  const provider = getProviderBySlug(slug);
  if (!provider) {
    return buildMetadata({
      title: "Professional profile",
      description: "View this professional’s profile and request a quote.",
      path: `/professionals/${slug}`,
    });
  }
  return buildMetadata({
    title: `${provider.companyName} | ${provider.city}, ${provider.state}`,
    description: provider.description,
    path: `/professionals/${provider.slug}`,
    keywords: [
      provider.companyName,
      `${provider.city} home services`,
      `${provider.street}, ${provider.city}, ${provider.state}`,
      ...provider.categoryIds.flatMap((id) => {
        const category = getServiceCategoryById(id);
        return category
          ? getLocalKeywordPhrases({
              category,
              city: provider.city,
              state: provider.state,
              zip: provider.zip,
              limit: 8,
            })
          : [];
      }),
      ...provider.categoryIds.map((id) => getServiceCategoryById(id)?.name ?? ""),
    ].filter(Boolean),
  });
}

function firstQuery(value: string | string[] | undefined) {
  return typeof value === "string" ? value : value?.[0];
}

export default async function ProviderProfilePage({
  params,
  searchParams,
}: PageParams<{ slug: string }>) {
  const { slug } = await params;
  const query = await searchParams;
  const place = {
    zip: firstQuery(query.zip),
    city: firstQuery(query.city),
    state: firstQuery(query.state),
    location: firstQuery(query.location),
  };

  const provider = getProviderBySlug(slug);
  if (provider) {
    const categories = provider.categoryIds
      .map((id) => getServiceCategoryById(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return (
      <>
        <JsonLd
          data={[
            {
              ...providerJsonLd(provider, categories),
              priceRange: formatStartingPrice(getStartingPrice(provider)),
            },
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Find a Professional", path: "/find-a-professional" },
              { name: provider.companyName, path: `/professionals/${provider.slug}` },
            ]),
          ]}
        />
        <ProviderProfile provider={provider} categories={categories} place={place} />
      </>
    );
  }

  return <PublicProfessionalDetail slug={slug} place={place} />;
}
