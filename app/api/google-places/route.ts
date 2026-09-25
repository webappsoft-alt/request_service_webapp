import { NextRequest } from "next/server";
import type { PlaceAddress, PlaceSuggestion } from "@/lib/google-places";

type AddressComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

function googlePlacesKey(): string {
  // Prefer the server-only key. NEXT_PUBLIC_* is inlined at build time and
  // Netlify redacts those values out of uploaded functions.
  return (
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY?.trim() ||
    ""
  );
}

function componentName(
  components: AddressComponent[] | undefined,
  type: string,
  short = false,
): string {
  const match = (components ?? []).find((item) => item.types?.includes(type));
  if (!match) return "";
  return String((short ? match.short_name : match.long_name) || "").trim();
}

function parseAddress(
  formattedAddress: string | undefined,
  components: AddressComponent[] | undefined,
  latitude: number | null,
  longitude: number | null,
): PlaceAddress {
  const city =
    componentName(components, "locality") ||
    componentName(components, "postal_town") ||
    componentName(components, "administrative_area_level_2");
  const stateShort = componentName(components, "administrative_area_level_1", true);
  const stateLong = componentName(components, "administrative_area_level_1");
  const state = stateShort || stateLong;
  const zipCode = componentName(components, "postal_code");
  const countryShort = componentName(components, "country", true);
  const countryLong = componentName(components, "country");
  const formatted = formattedAddress?.trim() || "";

  const dropExact = new Set(
    [city, stateShort, stateLong, countryShort, countryLong, zipCode]
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  );
  const stateTokens = [stateShort, stateLong]
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const zipLower = zipCode.trim().toLowerCase();

  function shouldDropSegment(segment: string): boolean {
    const lower = segment.trim().toLowerCase();
    if (!lower) return true;
    if (dropExact.has(lower)) return true;
    const tokens = lower.split(/\s+/).filter(Boolean);
    const hasZip = Boolean(
      zipLower &&
        tokens.some(
          (token) =>
            token === zipLower || token.startsWith(`${zipLower}-`),
        ),
    );
    const hasState = stateTokens.some((token) => tokens.includes(token));
    if (hasZip && (hasState || tokens.length <= 2)) return true;
    return false;
  }

  let streetAddress = "";
  if (formatted) {
    streetAddress = formatted
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part && !shouldDropSegment(part))
      .join(", ")
      .trim();
  }

  if (!streetAddress) {
    const streetNumber = componentName(components, "street_number");
    const route = componentName(components, "route");
    const fromStreet = [streetNumber, route].filter(Boolean).join(" ").trim();
    const localName =
      [
        componentName(components, "premise"),
        componentName(components, "neighborhood"),
        componentName(components, "sublocality_level_1"),
        componentName(components, "sublocality"),
      ].find((part) => part && !dropExact.has(part.toLowerCase())) || "";
    streetAddress = [fromStreet, localName].filter(Boolean).join(", ").trim();
  }

  return {
    formattedAddress: formatted || streetAddress,
    streetAddress,
    city,
    state,
    zipCode,
    country: countryShort,
    latitude,
    longitude,
  };
}

async function googleJson(url: URL): Promise<Record<string, unknown>> {
  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });
  if (!response.ok) {
    throw new Error(`Google Places request failed (${response.status})`);
  }
  return (await response.json()) as Record<string, unknown>;
}

function googleError(status: unknown, message: unknown): string {
  const code = String(status || "UNKNOWN");
  const detail = typeof message === "string" && message.trim() ? ` — ${message}` : "";
  return `Google Places failed (${code})${detail}`;
}

export async function GET(request: NextRequest) {
  const key = googlePlacesKey();
  if (!key) {
    return Response.json(
      { error: "Google Places API key is not configured." },
      { status: 503 },
    );
  }

  const { searchParams } = request.nextUrl;
  const action = searchParams.get("action")?.trim() || "autocomplete";

  try {
    if (action === "autocomplete") {
      const query = searchParams.get("q")?.trim() ?? "";
      if (query.length < 2) return Response.json({ suggestions: [] });

      const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
      url.searchParams.set("input", query);
      // No `types` filter — matches GOOGLE_AUTOCOMPLETE.md (streets + places, not cities-only).
      url.searchParams.set("language", "en");
      url.searchParams.set("key", key);

      const data = await googleJson(url);
      const status = String(data.status || "");
      if (status === "ZERO_RESULTS") return Response.json({ suggestions: [] });
      if (status !== "OK") {
        return Response.json(
          { error: googleError(status, data.error_message) },
          { status: 502 },
        );
      }

      const predictions = Array.isArray(data.predictions) ? data.predictions : [];
      const suggestions: PlaceSuggestion[] = predictions
        .map((raw) => {
          const item = raw as Record<string, unknown>;
          const placeId = typeof item.place_id === "string" ? item.place_id : "";
          if (!placeId) return null;
          const structured = (item.structured_formatting || {}) as Record<string, unknown>;
          const description =
            typeof item.description === "string" ? item.description : placeId;
          return {
            id: placeId,
            placeId,
            description,
            mainText:
              (typeof structured.main_text === "string" && structured.main_text) ||
              description,
            secondaryText:
              typeof structured.secondary_text === "string"
                ? structured.secondary_text
                : "",
          };
        })
        .filter((item): item is PlaceSuggestion => Boolean(item));

      return Response.json({ suggestions });
    }

    if (action === "details") {
      const placeId = searchParams.get("placeId")?.trim() ?? "";
      if (!placeId) {
        return Response.json({ error: "placeId is required." }, { status: 400 });
      }

      const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      url.searchParams.set("place_id", placeId);
      url.searchParams.set("fields", "address_component,formatted_address,geometry");
      url.searchParams.set("language", "en");
      url.searchParams.set("key", key);

      const data = await googleJson(url);
      const status = String(data.status || "");
      const result = (data.result || null) as Record<string, unknown> | null;
      if (status !== "OK" || !result) {
        return Response.json(
          { error: googleError(status, data.error_message) },
          { status: 502 },
        );
      }

      const geometry = (result.geometry || {}) as Record<string, unknown>;
      const location = (geometry.location || {}) as Record<string, unknown>;
      const lat = typeof location.lat === "number" ? location.lat : null;
      const lng = typeof location.lng === "number" ? location.lng : null;

      return Response.json({
        address: parseAddress(
          typeof result.formatted_address === "string"
            ? result.formatted_address
            : undefined,
          result.address_components as AddressComponent[] | undefined,
          lat,
          lng,
        ),
      });
    }

    if (action === "reverse") {
      const lat = Number(searchParams.get("lat"));
      const lng = Number(searchParams.get("lng"));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return Response.json({ error: "Invalid coordinates." }, { status: 400 });
      }

      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("latlng", `${lat},${lng}`);
      url.searchParams.set("language", "en");
      url.searchParams.set("key", key);

      const data = await googleJson(url);
      const status = String(data.status || "");
      const results = Array.isArray(data.results) ? data.results : [];
      if (status !== "OK" || !results.length) {
        return Response.json(
          { error: googleError(status, data.error_message) },
          { status: 502 },
        );
      }

      const picked =
        results.find((raw) => {
          const item = raw as Record<string, unknown>;
          const components = Array.isArray(item.address_components)
            ? (item.address_components as AddressComponent[])
            : [];
          return components.some((component) =>
            component.types?.includes("locality"),
          );
        }) ?? results[0];
      const result = picked as Record<string, unknown>;
      const geometry = (result.geometry || {}) as Record<string, unknown>;
      const location = (geometry.location || {}) as Record<string, unknown>;

      return Response.json({
        address: parseAddress(
          typeof result.formatted_address === "string"
            ? result.formatted_address
            : undefined,
          result.address_components as AddressComponent[] | undefined,
          typeof location.lat === "number" ? location.lat : lat,
          typeof location.lng === "number" ? location.lng : lng,
        ),
      });
    }

    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not reach Google Places.",
      },
      { status: 502 },
    );
  }
}
