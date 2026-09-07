export type MapboxAddress = {
  formattedAddress: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
};

export type MapboxSuggestion = MapboxAddress & {
  id: string;
};

type MapboxContextItem = {
  id?: string;
  text?: string;
  short_code?: string;
};

type MapboxFeature = {
  id?: string;
  place_name?: string;
  text?: string;
  address?: string;
  place_type?: string[];
  center?: [number, number];
  context?: MapboxContextItem[];
  properties?: { accuracy?: string };
};

type MapboxGeocodeResponse = {
  features?: MapboxFeature[];
  message?: string;
};

function contextByPrefix(context: MapboxContextItem[] | undefined, prefix: string) {
  return context?.find((item) => item.id?.startsWith(`${prefix}.`));
}

function parseRegion(shortCode?: string, fallbackText?: string) {
  if (shortCode?.includes("-")) {
    return shortCode.split("-").pop()?.toUpperCase() || fallbackText || "";
  }
  if (shortCode && shortCode.length <= 3) return shortCode.toUpperCase();
  return fallbackText?.trim() || "";
}

function parseCountry(shortCode?: string, fallbackText?: string) {
  if (shortCode) return shortCode.toUpperCase();
  return fallbackText?.trim() || "";
}

export function featureToAddress(feature: MapboxFeature): MapboxSuggestion {
  const context = feature.context ?? [];
  const types = feature.place_type ?? [];
  const postcode = contextByPrefix(context, "postcode");
  const place = contextByPrefix(context, "place");
  const locality = contextByPrefix(context, "locality");
  const district = contextByPrefix(context, "district");
  const neighborhood = contextByPrefix(context, "neighborhood");
  const region = contextByPrefix(context, "region");
  const country = contextByPrefix(context, "country");

  const isPlaceLike =
    types.includes("place") ||
    types.includes("locality") ||
    types.includes("district") ||
    types.includes("neighborhood") ||
    types.includes("region");

  const streetNumber = feature.address?.trim() || "";
  const streetName = feature.text?.trim() || "";
  const streetFromParts = [streetNumber, streetName].filter(Boolean).join(" ").trim();

  // For city/place results, prefer the full place_name as the address line.
  const streetAddress = isPlaceLike
    ? feature.place_name || streetName
    : streetFromParts || feature.place_name || "";

  const city = isPlaceLike
    ? feature.text || place?.text || locality?.text || ""
    : place?.text || locality?.text || district?.text || neighborhood?.text || "";

  const [lng, lat] = feature.center ?? [];

  return {
    id: feature.id || feature.place_name || streetAddress,
    formattedAddress: feature.place_name || streetAddress,
    streetAddress,
    city,
    state: parseRegion(region?.short_code, region?.text),
    zipCode: postcode?.text || (types.includes("postcode") ? feature.text || "" : ""),
    country: parseCountry(country?.short_code, country?.text),
    latitude: typeof lat === "number" ? lat : null,
    longitude: typeof lng === "number" ? lng : null,
  };
}

/**
 * Mapbox Geocoding API v5 — worldwide forward search (cities + addresses).
 * Uses `NEXT_PUBLIC_MAPBOX_PLACES_API_KEY` from `.env`.
 */
export async function searchMapboxAddresses(
  query: string,
  signal?: AbortSignal,
): Promise<MapboxSuggestion[]> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_PLACES_API_KEY?.trim();
  const trimmed = query.trim();
  if (!token || trimmed.length < 2) return [];

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("autocomplete", "true");
  // Worldwide: do NOT set `country`. Include place/region so city searches work.
  url.searchParams.set(
    "types",
    "address,place,locality,neighborhood,district,postcode,region",
  );
  url.searchParams.set("limit", "8");
  url.searchParams.set("language", "en");

  const response = await fetch(url.toString(), { signal, cache: "no-store" });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as MapboxGeocodeResponse | null;
    throw new Error(body?.message || `Mapbox request failed (${response.status})`);
  }

  const data = (await response.json()) as MapboxGeocodeResponse;
  return (data.features ?? []).map(featureToAddress);
}
