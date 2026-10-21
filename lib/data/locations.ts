/**
 * City / state directory behind /locations/* and /for-pros/locations/*.
 * Built from the Pro Service Areas city list plus the explore markets, so every
 * city a Pro can cover has a landing page.
 */

import { CITY_SERVICE_AREAS } from "@/lib/data/city-service-areas";
import { COLORADO_CITIES, FEATURED_MARKETS } from "@/lib/data/markets";
import { normalizeUsStateCode, usStateName } from "@/lib/data/us-states";
import { slugifyPlace } from "@/lib/public-paths";

export type LocationState = {
  code: string;
  name: string;
  /** URL segment, e.g. "co". */
  slug: string;
};

export type LocationCity = {
  city: string;
  state: LocationState;
  /** URL segment, e.g. "fort-collins". */
  slug: string;
  zip?: string;
};

function toState(code: string): LocationState | undefined {
  const normalized = normalizeUsStateCode(code);
  if (!normalized) return undefined;
  return { code: normalized, name: usStateName(normalized), slug: normalized.toLowerCase() };
}

const CITIES: LocationCity[] = (() => {
  const byKey = new Map<string, LocationCity>();
  const add = (city: string, stateCode: string, zip?: string) => {
    const state = toState(stateCode);
    if (!state) return;
    const slug = slugifyPlace(city);
    const key = `${state.slug}/${slug}`;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.zip && zip) existing.zip = zip;
      return;
    }
    byKey.set(key, { city, state, slug, zip });
  };
  for (const market of [...COLORADO_CITIES, ...FEATURED_MARKETS]) add(market.city, market.state, market.zip);
  for (const entry of CITY_SERVICE_AREAS) add(entry.city, entry.state, entry.areas.find((area) => area.zip)?.zip);
  return [...byKey.values()].sort(
    (a, b) => a.state.name.localeCompare(b.state.name) || a.city.localeCompare(b.city),
  );
})();

export function listLocationCities(): LocationCity[] {
  return CITIES;
}

/** States that have at least one city page. */
export function listLocationStates(): LocationState[] {
  const seen = new Map<string, LocationState>();
  for (const entry of CITIES) seen.set(entry.state.slug, entry.state);
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getLocationState(slug: string): LocationState | undefined {
  const state = toState(slug);
  if (!state) return undefined;
  return CITIES.some((entry) => entry.state.slug === state.slug) ? state : undefined;
}

export function citiesInState(stateSlug: string): LocationCity[] {
  const slug = stateSlug.toLowerCase();
  return CITIES.filter((entry) => entry.state.slug === slug);
}

export function getLocationCity(stateSlug: string, citySlug: string): LocationCity | undefined {
  const state = stateSlug.toLowerCase();
  const city = citySlug.toLowerCase();
  return CITIES.find((entry) => entry.state.slug === state && entry.slug === city);
}

/** Resolve a free-text city + state (e.g. from ?city=Denver&state=CO) to its landing page. */
export function findLocationCity(city?: string, state?: string): LocationCity | undefined {
  const code = normalizeUsStateCode(state);
  if (!city?.trim() || !code) return undefined;
  return getLocationCity(code, slugifyPlace(city));
}

/** The explore markets (Colorado + featured metros) — linked from Pro landing pages. */
export function listActiveMarkets(): LocationCity[] {
  return [...COLORADO_CITIES.slice(0, 8), ...FEATURED_MARKETS]
    .map((market) => findLocationCity(market.city, market.state))
    .filter((entry): entry is LocationCity => Boolean(entry));
}

export function nearbyCities(entry: LocationCity, limit = 8): LocationCity[] {
  return citiesInState(entry.state.slug)
    .filter((item) => item.slug !== entry.slug)
    .slice(0, limit);
}

export function cityLabel(entry: LocationCity) {
  return `${entry.city}, ${entry.state.code}`;
}
