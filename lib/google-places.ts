export type PlaceAddress = {
  formattedAddress: string;
  streetAddress: string;
  city: string;
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
 * The API key stays on the server so Netlify does not redact it from client JS.
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

/** Reverse-geocode lat/lng into the same PlaceAddress shape. */
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
