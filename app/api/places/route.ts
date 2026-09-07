import { NextRequest } from "next/server";

export type PlaceSuggestion = {
  label: string;
  city: string;
  state?: string;
  zip?: string;
};

function asPlace(input: {
  city?: string;
  state?: string;
  stateCode?: string;
  zip?: string;
  name?: string;
}): PlaceSuggestion | null {
  const city = input.city?.trim() || input.name?.trim();
  if (!city && !input.zip) return null;

  const state = input.stateCode || input.state;
  const zip = input.zip?.match(/\d{5}/)?.[0];
  const label = [city, state].filter(Boolean).join(", ") + (zip ? ` ${zip}` : "");

  return {
    label: label.trim() || zip || city || "",
    city: city || zip || "",
    state,
    zip,
  };
}

/** Public place suggestions for the marketing search UI (no backend secrets). */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (lat && lon) {
    const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
    url.searchParams.set("latitude", lat);
    url.searchParams.set("longitude", lon);
    url.searchParams.set("localityLanguage", "en");

    const response = await fetch(url, { next: { revalidate: 3600 } });
    if (!response.ok) return Response.json({ places: [] });

    const data = (await response.json()) as {
      city?: string;
      locality?: string;
      principalSubdivisionCode?: string;
      principalSubdivision?: string;
      postcode?: string;
    };

    const place = asPlace({
      city: data.city || data.locality,
      state: data.principalSubdivision,
      stateCode: data.principalSubdivisionCode?.replace(/^US-/, ""),
      zip: data.postcode,
    });

    return Response.json({ places: place ? [place] : [] });
  }

  if (q.length < 2) return Response.json({ places: [] });

  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "6");
  url.searchParams.set("lang", "en");

  const response = await fetch(url, { next: { revalidate: 120 } });
  if (!response.ok) return Response.json({ places: [] });

  const data = (await response.json()) as {
    features?: {
      properties?: {
        name?: string;
        city?: string;
        state?: string;
        countrycode?: string;
        postcode?: string;
        type?: string;
      };
    }[];
  };

  const places = (data.features ?? [])
    .filter((feature) => {
      const code = feature.properties?.countrycode?.toLowerCase();
      return !code || code === "us";
    })
    .map((feature) =>
      asPlace({
        name: feature.properties?.name,
        city: feature.properties?.city || feature.properties?.name,
        state: feature.properties?.state,
        zip: feature.properties?.postcode,
      }),
    )
    .filter((place): place is PlaceSuggestion => Boolean(place))
    .filter(
      (place, index, list) =>
        list.findIndex((item) => item.label === place.label) === index,
    )
    .slice(0, 6);

  return Response.json({ places });
}
