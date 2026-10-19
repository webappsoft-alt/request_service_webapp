import { normalizeUsStateCode } from "@/lib/data/us-states";
import {
  getGooglePlaceDetails,
  searchGoogleAddresses,
  type PlaceAddress,
  type PlaceSuggestion,
} from "@/lib/google-places";

/**
 * Addresses typed straight into the chat ("8594 e nassau ave denver", "80202", "Denver").
 * Resolved silently in the background: a clear match is bound at once, an ambiguous one is
 * confirmed with suggestion chips in the chat — no popups, no "Where's the job?" loop.
 */

const STREET_SUFFIX =
  "st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court|pl|place|pkwy|parkway|cir|circle|ter|terrace|hwy|highway|trl|trail|loop|sq|square";

/** "<number> [dir] <name…> <suffix>" anywhere in the text, e.g. "8594 e nassau ave". */
const STREET_RE = new RegExp(
  `\\b\\d{1,6}\\s+(?:[nsew]\\.?\\s+)?[a-z0-9.'-]+(?:\\s+[a-z0-9.'-]+){0,4}?\\s+(?:${STREET_SUFFIX})\\b`,
  "i",
);
const ZIP_RE = /^\d{5}(?:-\d{4})?$/;
/**
 * Whole message is "City, ST" or "City ST" with the code in capitals ("Denver CO").
 * Lower-case "denver co" without a comma is left alone so chat like "say hi" (HI) or
 * "count me in" (IN) isn't read as a place; it still counts when answering "Where's the job?".
 */
const CITY_COMMA_STATE_RE = /^[A-Za-z][A-Za-z .'-]{1,40}?,\s*([A-Za-z]{2})$/;
const CITY_CAPS_STATE_RE = /^[A-Za-z][A-Za-z .'-]{1,40}?\s+([A-Z]{2})$/;
/** "my address is …", "I'm at …" — dropped before matching. */
const LEAD_IN_RE = /^(?:(?:my|the|job)\s+)?(?:address|location)(?:\s+is)?\s*:?\s+|^(?:i'?m|we'?re|it'?s|located)\s+(?:at|in)\s+|^at\s+/i;

export type TypedAddress = {
  /** Text to prefill into the Location Modal search. */
  query: string;
  /** The message was only an address (vs. a problem description that included one). */
  wholeMessage: boolean;
};

export function detectTypedAddress(text: string): TypedAddress | null {
  const value = text.trim().replace(/[.!?]+$/, "");
  if (!value) return null;
  const stripped = value.replace(LEAD_IN_RE, "").trim();

  if (ZIP_RE.test(stripped)) return { query: stripped, wholeMessage: true };

  const stateCode = (CITY_COMMA_STATE_RE.exec(stripped) || CITY_CAPS_STATE_RE.exec(stripped))?.[1];
  if (stateCode && normalizeUsStateCode(stateCode)) {
    return { query: stripped, wholeMessage: true };
  }

  const street = STREET_RE.exec(stripped);
  if (street) {
    return {
      query: stripped.slice(street.index).trim().slice(0, 160),
      wholeMessage: street.index === 0,
    };
  }
  return null;
}

/** Reply to "Where's the job?": anything short that could be a street, city or ZIP. */
export function couldBeAddress(text: string) {
  const value = text.trim();
  if (ZIP_RE.test(value)) return true;
  return value.length >= 3 && value.length <= 160 && /[a-z]/i.test(value);
}

function tokens(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Words that must appear in a suggestion: 3+ letters, numbers, and 2-letter state codes. */
function keyWords(query: string) {
  return tokens(query).filter((word) => word.length >= 3 || /^\d+$/.test(word) || normalizeUsStateCode(word));
}

/** The one suggestion we can bind without asking, or null when the customer should confirm. */
function confidentSuggestion(query: string, suggestions: PlaceSuggestion[]) {
  if (suggestions.length === 1) return suggestions[0];
  const value = query.trim();
  if (ZIP_RE.test(value)) {
    return suggestions.find((item) => item.description.includes(value.slice(0, 5))) ?? null;
  }
  // Every typed word present, and the suggestion starts like the query (same house
  // number / same city) — exactly one such match is a clear hit. "Denver" alone matches
  // Denver CO, PA and NC, so that one gets confirmed instead.
  const words = keyWords(value);
  const first = tokens(value)[0];
  const matches = suggestions.filter((item) => {
    const described = new Set(tokens(item.description));
    return tokens(item.description)[0] === first && words.every((word) => described.has(word));
  });
  return matches.length === 1 ? matches[0] : null;
}

export type TypedAddressResult = {
  /** Geocoded address (lat/lng set) when the match is unambiguous. */
  place: PlaceAddress | null;
  /** 2–4 candidates to confirm in the chat when it's ambiguous. */
  options: PlaceSuggestion[];
};

/** Place details (incl. lat/lng) for a suggestion; null when Google has no coordinates. */
export async function geocodeSuggestion(suggestion: PlaceSuggestion, signal?: AbortSignal) {
  const place = await getGooglePlaceDetails(suggestion.placeId, signal).catch(() => null);
  return place && place.latitude != null && place.longitude != null ? place : null;
}

/** Background lookup for a typed address (8s cap so the chat never hangs on it). */
export async function resolveTypedAddress(query: string): Promise<TypedAddressResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const suggestions = await searchGoogleAddresses(query, controller.signal).catch(() => []);
    if (!suggestions.length) return { place: null, options: [] };
    const options = suggestions.slice(0, 4);
    const pick = confidentSuggestion(query, suggestions);
    if (!pick) return { place: null, options };
    const place = await geocodeSuggestion(pick, controller.signal);
    return place ? { place, options: [] } : { place: null, options };
  } finally {
    clearTimeout(timer);
  }
}

const COUNTRY_PART = /^(usa|us|united states( of america)?)$/i;

/**
 * Compact chip label in the project's location format ("City, ST", as locationDisplayLabel /
 * placeCityLabel): "Denver, CO". Street results keep the street but drop country and ZIP:
 * "8594 E Nassau Ave, Denver, CO".
 */
export function suggestionLabel(option: PlaceSuggestion) {
  const parts = (option.secondaryText || option.description.split(",").slice(1).join(","))
    .split(",")
    .map((part) => part.trim().replace(/\s+\d{5}(?:-\d{4})?$/, ""))
    .filter((part) => part && !COUNTRY_PART.test(part));
  const main = (option.mainText || option.description.split(",")[0] || "").trim();
  // ZIP result → "City, ST 80202"
  if (/^\d{5}(?:-\d{4})?$/.test(main)) {
    const place = [parts[0], parts[1]].filter(Boolean).join(", ");
    return place ? `${place} ${main}` : main;
  }
  if (/^\d/.test(main)) return [main, ...parts.slice(0, 2)].join(", ");
  return [main, parts[parts.length - 1] === main ? null : parts[parts.length - 1]].filter(Boolean).join(", ");
}

/** Candidates in the customer's current state (saved / detected location) first, then city. */
export function rankNearby(options: PlaceSuggestion[], near: { state?: string; city?: string }) {
  const state = normalizeUsStateCode(near.state || "");
  const city = (near.city || "").split(",")[0]?.trim().toLowerCase();
  if (!state && !city) return options;
  const score = (option: PlaceSuggestion) => {
    const described = tokens(option.description);
    return (state && described.includes(state.toLowerCase()) ? 2 : 0) + (city && option.description.toLowerCase().includes(city) ? 1 : 0);
  };
  return options
    .map((option, index) => ({ option, index, score: score(option) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.option);
}
