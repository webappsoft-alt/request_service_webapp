import { notFound } from "next/navigation";
import { CategoryLinkGrid, LinkChips, LocationHeader } from "@/components/locations/location-sections";
import { ProRecruitCta } from "@/components/seo/pro-recruit-cta";
import { locationBreadcrumbs, locationMetadata, resolveLocationRoute } from "@/lib/data/location-routes";
import { citiesInState, listLocationStates } from "@/lib/data/locations";
import { serviceCategories } from "@/lib/data/services";
import { publicPaths } from "@/lib/public-paths";
import type { PageParams } from "@/lib/page-props";

export function generateStaticParams() {
  return listLocationStates().map((state) => ({ state: state.slug }));
}

export async function generateMetadata({ params }: PageParams<{ state: string }>) {
  return locationMetadata(resolveLocationRoute(await params));
}

export default async function LocationStatePage({ params }: PageParams<{ state: string }>) {
  const route = resolveLocationRoute(await params);
  if (!route) notFound();
  const { state } = route;
  const cities = citiesInState(state.slug);
  const topCity = cities[0];

  return (
    <>
      <LocationHeader
        breadcrumbs={locationBreadcrumbs(route)}
        eyebrow="Locations"
        title={`Home service pros in ${state.name}`}
        description={`Choose a ${state.name} city to compare licensed local professionals and request written estimates.`}
      />
      <LinkChips
        eyebrow={state.name}
        title={`Cities in ${state.name}`}
        items={cities.map((city) => ({
          label: city.city,
          href: publicPaths.locationCity(state.slug, city.slug),
        }))}
      />
      {topCity ? (
        <CategoryLinkGrid
          eyebrow="Popular"
          title={`Popular services in ${topCity.city}`}
          categories={serviceCategories}
          hrefFor={(category) => publicPaths.locationService(state.slug, topCity.slug, category.slug)}
        />
      ) : null}
      <ProRecruitCta place={state.name} />
    </>
  );
}
