import {
  getGooglePlaceDetails,
  searchGoogleAddresses,
  type PlaceAddress,
  type PlaceSuggestion,
} from "@/lib/google-places";

/**
 * Addresses typed straight into the chat ("8594 e nassau ave denver"), so the customer
 * isn't sent round the "Where's the job?" loop when they've already told us.
 */

const STREET_SUFFIX =
  "st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court|pl|place|pkwy|parkway|cir|circle|ter|terrace|hwy|highway|trl|trail|loop|sq|square";

/** "<number> [dir] <name…> <suffix>" anywhere in the text, e.g. "8594 e nassau ave". */
const STREET_RE = new RegExp(
  `\\b\\d{1,6}\\s+(?:[nsew]\\.?\\s+)?[a-z0-9.'-]+(?:\\s+[a-z0-9.'-]+){0,4}?\\s+(?:${STREET_SUFFIX})\\b`,
  "i",
);
const ZIP_RE = /^\d{5}(?:-\d{4})?$/;

/** The address part of a message ("…leaks at 8594 e nassau ave denver" → "8594 e nassau ave denver"). */
export function extractTypedAddress(text: string): string | null {
  const match = STREET_RE.exec(text);
  if (!match) return null;
  return text
    .slice(match.index)
    .replace(/[.!?]+$/, "")
    .trim()
    .slice(0, 160);
}

/** Reply to "Where's the job?": anything short that could be a street, city or ZIP. */
export function couldBeAddress(text: string) {
  const value = text.trim();
  if (ZIP_RE.test(value)) return true;
  return value.length >= 3 && value.length <= 160 && /[a-z]/i.test(value);
}

function words(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3);
}

/** A suggestion we can apply without asking, or null when the customer should pick. */
function confidentSuggestion(query: string, suggestions: PlaceSuggestion[]) {
  if (suggestions.length === 1) return suggestions[0];
  const value = query.trim();
  if (ZIP_RE.test(value)) {
    return suggestions.find((item) => item.description.includes(value.slice(0, 5))) ?? null;
  }
  const houseNumber = /^\D*?(\d{1,6})\s/.exec(value)?.[1];
  if (!houseNumber) return null;
  // Same house number and every typed word (street, city) present → one clear match.
  const typed = words(value);
  const matches = suggestions.filter((item) => {
    const description = item.description.toLowerCase();
    return description.startsWith(houseNumber) && typed.every((word) => description.includes(word));
  });
  return matches.length === 1 ? matches[0] : null;
}

export type TypedAddressResult = {
  /** Geocoded address (lat/lng set) when the match is unambiguous. */
  place: PlaceAddress | null;
  /** Candidates for one-tap selection when it's ambiguous. */
  options: PlaceSuggestion[];
};

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

export async function resolveTypedAddress(query: string): Promise<TypedAddressResult> {
  const { signal, done } = withTimeout(8000);
  try {
    const suggestions = await searchGoogleAddresses(query, signal).catch(() => []);
    if (!suggestions.length) return { place: null, options: [] };
    const options = suggestions.slice(0, 5);
    const pick = confidentSuggestion(query, suggestions);
    if (!pick) return { place: null, options };
    const place = await geocodeSuggestion(pick, signal);
    return place ? { place, options: [] } : { place: null, options };
  } finally {
    done();
  }
}

/** Place details (incl. lat/lng) for a suggestion; null when Google has no coordinates. */
export async function geocodeSuggestion(suggestion: PlaceSuggestion, signal?: AbortSignal) {
  const place = await getGooglePlaceDetails(suggestion.placeId, signal).catch(() => null);
  return place && place.latitude != null && place.longitude != null ? place : null;
}
