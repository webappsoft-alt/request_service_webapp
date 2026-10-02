export type PlaceAddress = {
  formattedAddress: string;
  /** Address line without city / state / ZIP / country. */
  streetAddress: string;
  city: string;
  /** Prefer 2-letter US code when Google provides short_name. */
  state: string;
  zipCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
};

export type PlaceSuggestion = {
  id: string;
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

type AddressComponent = {
  long_name?: string;
  short_name?: string;
  longText?: string;
  shortText?: string;
  types?: string[];
};

/** Common formatted-address spellings that differ from Google's country short_name. */
const COUNTRY_ALIASES: Record<string, string[]> = {
  us: [
    "us",
    "usa",
    "u.s.",
    "u.s.a.",
    "u.s.a",
    "united states",
    "united states of america",
  ],
  gb: ["gb", "uk", "u.k.", "united kingdom", "great britain"],
  ca: ["ca", "canada"],
  au: ["au", "australia"],
  nz: ["nz", "new zealand"],
  pk: ["pk", "pakistan"],
  in: ["in", "india"],
  mx: ["mx", "mexico"],
};

function componentLong(components: AddressComponent[] | undefined, type: string): string {
  const match = (components ?? []).find((item) => item.types?.includes(type));
  if (!match) return "";
  return String(match.long_name || match.longText || "").trim();
}

function componentShort(components: AddressComponent[] | undefined, type: string): string {
  const match = (components ?? []).find((item) => item.types?.includes(type));
  if (!match) return "";
  return String(match.short_name || match.shortText || match.long_name || match.longText || "").trim();
}

function countryAliasTokens(countryShort: string, countryLong: string): string[] {
  const seeds = [countryShort, countryLong]
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const out = new Set<string>(seeds);
  for (const seed of seeds) {
    const byCode = COUNTRY_ALIASES[seed];
    if (byCode) {
      for (const alias of byCode) out.add(alias);
    }
    for (const [code, aliases] of Object.entries(COUNTRY_ALIASES)) {
      if (aliases.includes(seed)) {
        out.add(code);
        for (const alias of aliases) out.add(alias);
      }
    }
  }
  return Array.from(out);
}

/**
 * Address field value: street / place line only — never city, state, ZIP, or country.
 * Prefer Google's street_number + route when present (e.g. "1041 Galapago St").
 */
function streetLineFromParts(
  components: AddressComponent[] | undefined,
  formattedAddress: string,
  placeName = "",
): string {
  const city =
    componentLong(components, "locality") ||
    componentLong(components, "postal_town") ||
    componentLong(components, "administrative_area_level_2");
  const stateShort = componentShort(components, "administrative_area_level_1");
  const stateLong = componentLong(components, "administrative_area_level_1");
  const countryShort = componentShort(components, "country");
  const countryLong = componentLong(components, "country");
  const zip =
    componentLong(components, "postal_code") ||
    componentShort(components, "postal_code");
  const zipSuffix = componentLong(components, "postal_code_suffix");

  const streetNumber =
    componentShort(components, "street_number") ||
    componentLong(components, "street_number");
  const route =
    componentShort(components, "route") || componentLong(components, "route");
  const fromStreet = [streetNumber, route].filter(Boolean).join(" ").trim();
  if (fromStreet) {
    const unit =
      componentShort(components, "subpremise") ||
      componentLong(components, "subpremise");
    return unit ? `${fromStreet} #${unit}` : fromStreet;
  }

  const dropExact = new Set(
    [
      city,
      stateShort,
      stateLong,
      countryShort,
      countryLong,
      zip,
      zipSuffix,
      zip && zipSuffix ? `${zip}-${zipSuffix}` : "",
      ...countryAliasTokens(countryShort, countryLong),
    ]
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  );

  const stateTokens = [stateShort, stateLong]
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const zipLower = zip.trim().toLowerCase();

  function shouldDropSegment(segment: string): boolean {
    const lower = segment.trim().toLowerCase();
    if (!lower) return true;
    if (dropExact.has(lower)) return true;

    // Lone country alias even when Google's short_name was "US" but text says "USA".
    if (countryAliasTokens(countryShort, countryLong).includes(lower)) return true;

    const tokens = lower.split(/\s+/).filter(Boolean);
    const hasZip = Boolean(
      zipLower &&
        tokens.some(
          (token) =>
            token === zipLower || token.startsWith(`${zipLower}-`),
        ),
    );
    const hasState = stateTokens.some((token) => tokens.includes(token));

    // "CA 90210", "IL 62701-1234", "Denver CO", or a lone ZIP segment
    if (hasZip && (hasState || tokens.length <= 2)) return true;
    if (hasState && tokens.length === 1) return true;
    if (hasState && hasZip) return true;
    return false;
  }

  if (formattedAddress.trim()) {
    const kept = formattedAddress
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part && !shouldDropSegment(part));
    const joined = kept.join(", ").trim();
    if (joined) return joined;
  }

  // Fallback when formatted address is missing: premise / neighborhood / name.
  const localName =
    [
      componentLong(components, "premise"),
      componentLong(components, "neighborhood"),
      componentLong(components, "sublocality_level_1"),
      componentLong(components, "sublocality"),
      placeName.trim(),
    ]
      .map((part) => part.trim())
      .find((part) => part && !dropExact.has(part.toLowerCase())) || "";

  return localName;
}

/**
 * Canonical parser from GOOGLE_AUTOCOMPLETE.md / binsapp `parseAddressComponents`.
 * Address field = street / place line only (never city / state / ZIP / country).
 */
export function parseGoogleAddressComponents(
  components: AddressComponent[] | undefined,
  formattedAddress?: string,
  latitude: number | null = null,
  longitude: number | null = null,
  placeName = "",
): PlaceAddress {
  const formatted = String(formattedAddress || "").trim();
  const streetAddress = streetLineFromParts(components, formatted, placeName);

  const city =
    componentLong(components, "locality") ||
    componentLong(components, "postal_town") ||
    componentLong(components, "administrative_area_level_2");

  const stateShort = componentShort(components, "administrative_area_level_1");
  const stateLong = componentLong(components, "administrative_area_level_1");
  // Prefer short_name (CA) for our US state dropdown; keep long as fallback.
  const state = stateShort || stateLong;

  let zipCode =
    componentLong(components, "postal_code") ||
    componentShort(components, "postal_code");
  const zipSuffix = componentLong(components, "postal_code_suffix");
  if (zipCode && zipSuffix && !zipCode.includes("-")) {
    zipCode = `${zipCode}-${zipSuffix}`;
  }

  const country = componentShort(components, "country");

  return {
    formattedAddress: formatted || streetAddress,
    streetAddress,
    city,
    state,
    zipCode,
    country,
    latitude,
    longitude,
  };
}

/** Parse a native `google.maps.places.PlaceResult`. */
export function placeAddressFromGooglePlace(place: {
  formatted_address?: string;
  name?: string;
  address_components?: AddressComponent[];
  geometry?: { location?: { lat: () => number; lng: () => number } };
}): PlaceAddress | null {
  const location = place.geometry?.location;
  if (!location || typeof location.lat !== "function") return null;
  const lat = location.lat();
  const lng = location.lng();
  return parseGoogleAddressComponents(
    place.address_components,
    place.formatted_address || place.name,
    Number.isFinite(lat) ? lat : null,
    Number.isFinite(lng) ? lng : null,
    place.name || "",
  );
}

async function googlePlacesApi<T>(
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  const search = new URLSearchParams(params);
  const response = await fetch(`/api/google-places?${search.toString()}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!response.ok) {
    throw new Error(data?.error || "Google Places request failed.");
  }
  if (!data) throw new Error("Google Places request failed.");
  return data;
}

/**
 * Full street-address suggestions via the server-side Google Places proxy.
 * Prefer client-side `google.maps.places.Autocomplete` for the address input UI.
 */
export async function searchGoogleAddresses(
  query: string,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const data = await googlePlacesApi<{ suggestions?: PlaceSuggestion[] }>(
    { action: "autocomplete", q: trimmed },
    signal,
  );
  return Array.isArray(data.suggestions) ? data.suggestions : [];
}

/** Resolve place_id into structured address fields. */
export async function getGooglePlaceDetails(
  placeId: string,
  signal?: AbortSignal,
): Promise<PlaceAddress> {
  if (!placeId.trim()) throw new Error("placeId is required.");
  const data = await googlePlacesApi<{ address?: PlaceAddress }>(
    { action: "details", placeId: placeId.trim() },
    signal,
  );
  if (!data.address) throw new Error("Google Places details failed.");
  return data.address;
}

/** Reverse-geocode lat/lng into the same PlaceAddress shape (REST fallback). */
export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<PlaceAddress> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Invalid coordinates.");
  }
  const data = await googlePlacesApi<{ address?: PlaceAddress }>(
    {
      action: "reverse",
      lat: String(latitude),
      lng: String(longitude),
    },
    signal,
  );
  if (!data.address) throw new Error("Could not resolve current location.");
  return data.address;
}
