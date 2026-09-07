import { slugifyJob } from "@/lib/data/jobs";
import {
  COLORADO_CITIES,
  findMarketCity,
  firstSearchValue,
  getMarketByZip,
  marketsForState,
} from "@/lib/data/markets";
import { parsePlaceInput, type ExplorePlace } from "@/lib/data/markets";
import { directoryHref, getRelatedCategories } from "@/lib/data/related-categories";
import { serviceCategories } from "@/lib/data/services";
import type { ServiceCategory, ServiceCategorySlug } from "@/lib/types";

export type LocalKeywordItem = {
  label: string;
  href: string;
};

type TradeNouns = {
  people: string;
  service: string;
};

const TRADE_NOUNS: Record<ServiceCategorySlug, TradeNouns> = {
  plumbing: { people: "plumbers", service: "plumbing" },
  hvac: { people: "HVAC technicians", service: "HVAC" },
  electrical: { people: "electricians", service: "electrical" },
  handyman: { people: "handymen", service: "handyman" },
  "house-cleaning": { people: "house cleaners", service: "house cleaning" },
  roofing: { people: "roofers", service: "roofing" },
  landscaping: { people: "landscapers", service: "landscaping" },
  painting: { people: "painters", service: "painting" },
  "bathroom-remodeling": { people: "bathroom remodelers", service: "bathroom remodeling" },
  "pest-control": { people: "pest control", service: "pest control" },
};

export type LocalKeywordInput = {
  category?: ServiceCategory;
  job?: string;
  city?: string;
  state?: string;
  zip?: string;
  loc?: string;
  basePath?: "/services" | "/find-a-professional";
  limit?: number;
};

function unique<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const next = key(item);
    if (seen.has(next)) return false;
    seen.add(next);
    return true;
  });
}

function nounsFor(category: ServiceCategory): TradeNouns {
  return TRADE_NOUNS[category.slug] ?? { people: category.shortName.toLowerCase(), service: category.name.toLowerCase() };
}

function jobPrefix(job: string, category: ServiceCategory) {
  const nouns = nounsFor(category);
  const strip = [nouns.service, nouns.people, category.name, category.shortName]
    .map((value) => value.toLowerCase())
    .join("|");
  return job
    .toLowerCase()
    .replace(new RegExp(`\\b(?:${strip})\\b`, "g"), " ")
    .replace(/\b(?:or|the|a|an)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function locValue(city: string, state?: string) {
  return state ? `${city}, ${state}` : city;
}

export function resolveKeywordPlace(input: {
  city?: string;
  state?: string;
  zip?: string;
  loc?: string;
}): ExplorePlace {
  const parsed = parsePlaceInput(input.loc);
  const zip = input.zip || parsed.zip;
  const fromZip = getMarketByZip(zip);
  const cityName = input.city?.trim() || parsed.city || fromZip?.city;
  const state = input.state?.trim() || parsed.state || fromZip?.state;
  const matched = findMarketCity(cityName, state);
  return {
    zip: zip || matched?.zip || fromZip?.zip,
    city: matched?.city || cityName,
    state: matched?.state || state || fromZip?.state,
    location: input.loc || parsed.location,
  };
}

export function readPlaceFromSearch(params: Record<string, string | string[] | undefined>) {
  return resolveKeywordPlace({
    zip: firstSearchValue(params.zip),
    loc: firstSearchValue(params.loc) || firstSearchValue(params.location),
    city: firstSearchValue(params.city),
    state: firstSearchValue(params.state),
  });
}

export function jobKeywordPhrases(job: string, category: ServiceCategory, city: string) {
  const cityLabel = city.toLowerCase();
  const nouns = nounsFor(category);
  const prefix = jobPrefix(job, category);
  const phrases = prefix
    ? [`${prefix} ${nouns.people} ${cityLabel}`, `${prefix} ${nouns.service} ${cityLabel}`]
    : [`${nouns.people} ${cityLabel}`, `${nouns.service} ${cityLabel}`];
  phrases.push(`${job.toLowerCase()} ${cityLabel}`);
  return unique(phrases, (phrase) => phrase);
}

export function primaryJobKeyword(job: string, category: ServiceCategory, city: string) {
  const phrases = jobKeywordPhrases(job, category, city);
  if (category.slug === "painting" && /exterior/i.test(job)) {
    return phrases.find((phrase) => phrase.includes("painting")) ?? phrases[0];
  }
  return phrases[0];
}

function hrefFor(
  basePath: "/services" | "/find-a-professional",
  category: ServiceCategory | undefined,
  job: string | undefined,
  place: ExplorePlace,
) {
  return directoryHref(basePath, {
    service: category?.slug,
    job,
    zip: place.zip,
    loc: place.city ? locValue(place.city, place.state) : place.location || place.state,
  });
}

function itemsForCity(
  category: ServiceCategory,
  city: string,
  place: ExplorePlace,
  basePath: "/services" | "/find-a-professional",
  jobs = category.commonServices,
): LocalKeywordItem[] {
  return jobs.map((job) => ({
    label: primaryJobKeyword(job, category, city),
    href: hrefFor(basePath, category, slugifyJob(job), { ...place, city }),
  }));
}

export function getLocalKeywordItems(input: LocalKeywordInput): LocalKeywordItem[] {
  const limit = input.limit ?? 24;
  const basePath = input.basePath ?? "/find-a-professional";
  const place = resolveKeywordPlace(input);
  const category = input.category;
  const items: LocalKeywordItem[] = [];

  if (place.city && category) {
    const jobs = input.job
      ? [input.job, ...category.commonServices.filter((job) => job !== input.job)]
      : category.commonServices;
    items.push(...itemsForCity(category, place.city, place, basePath, jobs));
    for (const related of getRelatedCategories(category.slug).slice(0, 3)) {
      items.push({
        label: `${nounsFor(related).people} ${place.city.toLowerCase()}`,
        href: hrefFor(basePath, related, undefined, place),
      });
    }
  } else if (place.city) {
    for (const item of serviceCategories) {
      items.push({
        label: `${nounsFor(item).people} ${place.city.toLowerCase()}`,
        href: hrefFor(basePath, item, undefined, place),
      });
      items.push(
        ...item.commonServices.slice(0, 2).map((job) => ({
          label: primaryJobKeyword(job, item, place.city ?? ""),
          href: hrefFor(basePath, item, slugifyJob(job), place),
        })),
      );
    }
  } else if (place.state) {
    const cities = marketsForState(place.state);
    const focus = category ? [category] : serviceCategories.slice(0, 6);
    const cityLimit = category ? cities.length : Math.min(cities.length, 8);
    for (const market of cities.slice(0, cityLimit)) {
      for (const item of focus) {
        const jobs = category ? item.commonServices.slice(0, 2) : item.commonServices.slice(0, 1);
        items.push(...itemsForCity(item, market.city, { ...place, ...market }, basePath, jobs));
      }
    }
  }

  return unique(items, (item) => item.label).slice(0, limit);
}

export function getLocalKeywordPhrases(input: LocalKeywordInput) {
  const place = resolveKeywordPlace(input);
  const phrases = getLocalKeywordItems({ ...input, limit: input.limit ?? 16 }).map((item) => item.label);

  if (place.city && input.category) {
    const nouns = nounsFor(input.category);
    phrases.unshift(
      `${nouns.people} ${place.city.toLowerCase()}`,
      `${input.category.name.toLowerCase()} ${place.city.toLowerCase()}`,
    );
  }

  if (place.state === "CO" && input.category) {
    phrases.push(
      `${nounsFor(input.category).people} colorado`,
      ...COLORADO_CITIES.slice(0, 8).map(
        (market) => `${nounsFor(input.category!).people} ${market.city.toLowerCase()}`,
      ),
    );
  }

  return unique(phrases, (phrase) => phrase.toLowerCase());
}

export function getLocalPageCopy(input: LocalKeywordInput) {
  const place = resolveKeywordPlace(input);
  const category = input.category;
  const nouns = category ? nounsFor(category) : undefined;
  const city = place.city;
  const region = city && place.state ? `${city}, ${place.state}` : city || (place.state === "CO" ? "Colorado" : place.state);

  if (input.job && city && category) {
    const phrase = primaryJobKeyword(input.job, category, city);
    const withoutCity = phrase.replace(new RegExp(`\\s+${city.toLowerCase()}$`), "").trim();
    const titled = withoutCity.replace(/\b\w/g, (letter) => letter.toUpperCase());
    return {
      title: `${titled} in ${region}`,
      description: `Compare ${phrase} and related ${nouns?.people ?? "pros"} with written estimates before you hire.`,
    };
  }

  if (category && region) {
    return {
      title: `${category.name} in ${region}`,
      description: `Find ${nouns?.people ?? category.name.toLowerCase()} in ${region}. Compare local companies for ${category.commonServices.slice(0, 3).map((job) => job.toLowerCase()).join(", ")}, then request a written estimate.`,
    };
  }

  return undefined;
}
