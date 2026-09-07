import { getJobPath, slugifyJob } from "@/lib/data/jobs";
import { primaryJobKeyword } from "@/lib/data/local-keywords";
import {
  getExplorePlaceLabel,
  getMarketByZip,
  parsePlaceInput,
  stateCode,
  type ExplorePlace,
} from "@/lib/data/markets";
import { getAllProviders } from "@/lib/data/providers";
import { directoryHref, getRelatedCategories } from "@/lib/data/related-categories";
import { getAreaName } from "@/lib/data/service-areas";
import { serviceCategories } from "@/lib/data/services";
import type { Provider, ServiceCategory } from "@/lib/types";

export type { ExplorePlace };
export { getExplorePlaceLabel, parsePlaceInput };

export type ExploreLink = {
  href: string;
  label: string;
};

export type ExploreColumn = {
  id: "estimates" | "popular" | "compare" | "areas";
  eyebrow: string;
  title: string;
  links: ExploreLink[];
};

function uniqueLinks(links: ExploreLink[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.href}|${link.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function placeFromZip(zip?: string): ExplorePlace | undefined {
  if (!zip || !/^\d{5}$/.test(zip)) return undefined;
  const market = getMarketByZip(zip);
  if (market) return { zip, city: market.city, state: market.state };
  const providers = getAllProviders();
  const match =
    providers.find((provider) => provider.zip === zip) ??
    providers.find((provider) => provider.serviceArea.includes(zip));
  return match ? { zip, city: match.city, state: match.state } : { zip };
}

export function resolveExplorePlace(provider: Provider, hint: ExplorePlace = {}): ExplorePlace {
  const fromLocation = parsePlaceInput(hint.location);
  const fromZip = placeFromZip(hint.zip);
  const hasHint = Boolean(hint.zip || hint.city || hint.state || hint.location);
  const city = hint.city?.trim() || fromLocation.city || fromZip?.city || (!hasHint ? provider.city : undefined);
  const state =
    stateCode(hint.state) ||
    fromLocation.state ||
    fromZip?.state ||
    (!hasHint || !city ? provider.state : undefined);
  const zip = hint.zip || fromLocation.zip || fromZip?.zip || provider.zip;
  return { zip, city, state };
}

export function getProfileExplore(
  provider: Provider,
  categories: ServiceCategory[],
  hint: ExplorePlace = {},
): ExploreColumn[] {
  const primary = categories[0];
  const related = getRelatedCategories(primary?.slug);
  const place = resolveExplorePlace(provider, hint);
  const placeLabel = getExplorePlaceLabel(place);
  const zip = place.zip || provider.zip;

  const estimateLinks = uniqueLinks(
    categories.flatMap((category) =>
      category.commonServices.map((job) => ({
        href: directoryHref("/get-a-quote", { service: category.slug, job: slugifyJob(job) }),
        label: /estimate/i.test(job) ? job : `${job} estimate`,
      })),
    ),
  );

  const loc = place.city ? `${place.city}${place.state ? `, ${place.state}` : ""}` : undefined;
  const popularLinks = uniqueLinks([
    ...categories.flatMap((category) =>
      category.commonServices.map((job) => ({
        href: directoryHref("/find-a-professional", {
          service: category.slug,
          job: slugifyJob(job),
          zip,
          loc,
        }),
        label: primaryJobKeyword(job, category, placeLabel),
      })),
    ),
    ...serviceCategories.map((category) => ({
      href: directoryHref("/find-a-professional", { service: category.slug, zip, loc }),
      label: `${category.name} in ${placeLabel}`,
    })),
  ]);

  const compareLinks = uniqueLinks([
    ...related.map((category) => ({
      href: directoryHref("/find-a-professional", { service: category.slug, zip }),
      label: `${category.name} near me`,
    })),
    ...(primary?.commonServices.slice(0, 6).map((job) => ({
      href: getJobPath(primary.slug, job),
      label: `${job} near me`,
    })) ?? []),
  ]);

  const areaLinks = uniqueLinks(
    provider.serviceArea.map((areaZip) => ({
      href: directoryHref("/find-a-professional", {
        service: primary?.slug,
        zip: areaZip,
      }),
      label: primary
        ? `${getAreaName(areaZip)} ${primary.shortName}`
        : getAreaName(areaZip),
    })),
  );

  const columns: ExploreColumn[] = [
    {
      id: "estimates",
      eyebrow: "Written estimates",
      title: "Typical starting prices",
      links: estimateLinks,
    },
    {
      id: "popular",
      eyebrow: place.city ? `In ${placeLabel}` : `Across ${placeLabel}`,
      title: `Popular in ${placeLabel}`,
      links: popularLinks,
    },
    {
      id: "compare",
      eyebrow: "Keep looking",
      title: "You might also like",
      links: compareLinks,
    },
    {
      id: "areas",
      eyebrow: "Service area",
      title: "In other nearby areas",
      links: areaLinks,
    },
  ];

  return columns.filter((column) => column.links.length);
}
