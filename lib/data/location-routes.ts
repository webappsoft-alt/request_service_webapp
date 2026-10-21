/**
 * Param resolution, breadcrumbs, and live data shared by the /locations/* route segments.
 */

import { getJobRecord } from "@/lib/data/jobs";
import { localServiceDescription, localServiceTitle, tradePeople } from "@/lib/data/local-seo-copy";
import {
  cityLabel,
  getLocationCity,
  getLocationState,
  type LocationCity,
  type LocationState,
} from "@/lib/data/locations";
import {
  fetchPublicProfessionalsForSeo,
  type PublicProfessionalSeoData,
} from "@/lib/data/public-professional-seo";
import { getServiceCategoryBySlug } from "@/lib/data/services";
import { publicPaths } from "@/lib/public-paths";
import { buildMetadata } from "@/lib/seo";
import type { BreadcrumbItem } from "@/components/seo/breadcrumbs";
import type { ServiceCategory } from "@/lib/types";

export type LocationRouteParams = {
  state: string;
  city?: string;
  category?: string;
  subcategory?: string;
};

export type ResolvedLocationRoute = {
  state: LocationState;
  city?: LocationCity;
  category?: ServiceCategory;
  job?: { name: string; slug: string };
};

/** undefined when any segment is unknown → the page calls notFound(). */
export function resolveLocationRoute(params: LocationRouteParams): ResolvedLocationRoute | undefined {
  const state = getLocationState(params.state);
  if (!state || params.state !== state.slug) return undefined;
  if (!params.city) return { state };

  const city = getLocationCity(state.slug, params.city);
  if (!city || params.city !== city.slug) return undefined;
  if (!params.category) return { state, city };

  const category = getServiceCategoryBySlug(params.category);
  if (!category) return undefined;
  if (!params.subcategory) return { state, city, category };

  const record = getJobRecord(category.slug, params.subcategory);
  if (!record) return undefined;
  return { state, city, category, job: { name: record.job, slug: record.slug } };
}

export function locationBreadcrumbs({ state, city, category, job }: ResolvedLocationRoute): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    { name: "Home", path: "/" },
    { name: "Locations", path: publicPaths.locations },
    { name: state.name, path: publicPaths.locationState(state.slug) },
  ];
  if (city) items.push({ name: city.city, path: publicPaths.locationCity(state.slug, city.slug) });
  if (city && category) {
    items.push({ name: category.name, path: publicPaths.locationService(state.slug, city.slug, category.slug) });
  }
  if (city && category && job) {
    items.push({
      name: job.name,
      path: publicPaths.locationSubService(state.slug, city.slug, category.slug, job.slug),
    });
  }
  return items;
}

export function locationPath(route: ResolvedLocationRoute) {
  const crumbs = locationBreadcrumbs(route);
  return crumbs[crumbs.length - 1].path;
}

export function locationMetadata(route: ResolvedLocationRoute | undefined) {
  if (!route) {
    return buildMetadata({
      title: "Location not found",
      description: "We don't have a page for that location yet.",
      path: publicPaths.locations,
      index: false,
    });
  }
  const { state, city, category, job } = route;
  const path = locationPath(route);

  if (city && category) {
    const nouns = tradePeople(category);
    return buildMetadata({
      title: localServiceTitle(category, city, job?.name),
      description: localServiceDescription(category, city, job?.name),
      path,
      keywords: [
        `${nouns} ${city.city}`,
        `${(job?.name ?? category.name).toLowerCase()} ${city.city}`,
        `${(job?.name ?? category.name).toLowerCase()} near me`,
        `${category.name.toLowerCase()} ${cityLabel(city)}`,
        `best ${nouns} in ${city.city}`,
      ],
    });
  }

  if (city) {
    return buildMetadata({
      title: `Home Service Pros in ${cityLabel(city)}`,
      description: `Find licensed ${city.city} plumbers, electricians, HVAC technicians, handymen, and more. Compare local companies and hire with a written estimate.`,
      path,
      keywords: [
        `home services ${city.city}`,
        `contractors ${city.city}`,
        `${city.city} plumbers`,
        `${city.city} electricians`,
        `${city.city} handyman`,
      ],
    });
  }

  return buildMetadata({
    title: `Home Service Pros in ${state.name}`,
    description: `Browse ${state.name} cities to find licensed local professionals for plumbing, HVAC, electrical, cleaning, roofing, and more.`,
    path,
    keywords: [`home services ${state.name}`, `contractors ${state.name}`, `${state.name} plumbers`],
  });
}

/** Live Pros based in the city; narrowed to the category when one is given. */
export async function liveProsForCity(city: LocationCity, category?: ServiceCategory, limit = 9) {
  const { items } = await fetchPublicProfessionalsForSeo({
    city: city.city,
    state: city.state.code,
    limit: category ? 50 : limit,
  });
  const matches = (pro: PublicProfessionalSeoData) =>
    !category ||
    pro.categoryNames.some((name) => name.trim().toLowerCase() === category.name.toLowerCase());
  return items.filter(matches).slice(0, limit);
}
