import { PublicProfessionalDetail } from "@/components/marketplace/public-professional-detail";
import { JsonLd } from "@/components/seo/json-ld";
import { getLocalKeywordPhrases } from "@/lib/data/local-keywords";
import { findLocationCity } from "@/lib/data/locations";
import { fetchPublicProfessionalForSeo } from "@/lib/data/public-professional-seo";
import { getStartingPrice } from "@/lib/data/provider-media";
import { getProviderBySlug } from "@/lib/data/providers";
import { getServiceCategoryById } from "@/lib/data/services";
import { formatStartingPrice } from "@/lib/format";
import { breadcrumbJsonLd, liveProfessionalJsonLd, providerJsonLd } from "@/lib/json-ld";
import { publicPaths } from "@/lib/public-paths";
import { buildMetadata } from "@/lib/seo";
import type { PageParams } from "@/lib/page-props";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageParams<{ slug: string }>) {
  const { slug } = await params;
  const liveProfessional = await fetchPublicProfessionalForSeo(slug);
  const seededProvider = getProviderBySlug(slug);
  const provider = seededProvider;

  if (!liveProfessional && !provider) {
    return buildMetadata({
      title: "Professional profile",
      description: "View this professional’s profile and request a quote.",
      path: publicPaths.professional(slug),
    });
  }

  if (liveProfessional) {
    const liveCategoryNames = liveProfessional.categoryIds
      .map((id) => getServiceCategoryById(id)?.name)
      .filter((item): item is string => Boolean(item));
    const city = liveProfessional.city || provider?.city || "";
    const state = liveProfessional.state || provider?.state || "";
    const locationLabel = [city, state].filter(Boolean).join(", ");
    return buildMetadata({
      title: locationLabel
        ? `${liveProfessional.companyName} | ${locationLabel}`
        : liveProfessional.companyName,
      description:
        liveProfessional.description ||
        provider?.description ||
        "View this professional’s profile and request a quote.",
      path: publicPaths.professional(liveProfessional.slug || slug),
      keywords: [
        liveProfessional.companyName,
        city ? `${city} home services` : "",
        city ? `${city}${state ? `, ${state}` : ""}` : "",
        ...liveCategoryNames,
      ].filter(Boolean),
    });
  }

  if (!provider) {
    return buildMetadata({
      title: "Professional profile",
      description: "View this professional’s profile and request a quote.",
      path: publicPaths.professional(slug),
    });
  }

  return buildMetadata({
    title: `${provider.companyName} | ${provider.city}, ${provider.state}`,
    description: provider.description,
    path: publicPaths.professional(provider.slug),
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
  const categories = provider
    ? provider.categoryIds
        .map((id) => getServiceCategoryById(id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];
  // Live (API) Pros: same fetch as generateMetadata, served from the fetch cache.
  const liveProfessional = provider ? null : await fetchPublicProfessionalForSeo(slug);
  const liveCity = liveProfessional
    ? findLocationCity(liveProfessional.city, liveProfessional.state)
    : undefined;

  return (
    <>
      {liveProfessional ? (
        <JsonLd
          data={[
            liveProfessionalJsonLd({ ...liveProfessional, slug: liveProfessional.slug || slug }),
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              ...(liveCity
                ? [
                    { name: "Locations", path: publicPaths.locations },
                    { name: liveCity.state.name, path: publicPaths.locationState(liveCity.state.slug) },
                    { name: liveCity.city, path: publicPaths.locationCity(liveCity.state.slug, liveCity.slug) },
                  ]
                : [{ name: "Find a Professional", path: "/find-a-professional" }]),
              { name: liveProfessional.companyName, path: publicPaths.professional(liveProfessional.slug || slug) },
            ]),
          ]}
        />
      ) : null}
      {provider ? (
        <JsonLd
          data={[
            {
              ...providerJsonLd(provider, categories),
              priceRange: formatStartingPrice(getStartingPrice(provider)),
            },
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Find a Professional", path: "/find-a-professional" },
              { name: provider.companyName, path: publicPaths.professional(provider.slug) },
            ]),
          ]}
        />
      ) : null}
      <PublicProfessionalDetail
        slug={slug}
        place={place}
        fallbackProvider={provider ?? null}
        fallbackCategories={categories}
      />
    </>
  );
}
