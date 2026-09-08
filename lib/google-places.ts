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

type AddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type AutocompletePrediction = {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
};

type PlaceResult = {
  formatted_address?: string;
  address_components?: AddressComponent[];
  geometry?: {
    location?: {
      lat: () => number;
      lng: () => number;
    };
  };
};

type PlacesServiceStatus = string;

type GooglePlacesNamespace = {
  AutocompleteService: new () => {
    getPlacePredictions: (
      request: { input: string; types?: string[] },
      callback: (
        predictions: AutocompletePrediction[] | null,
        status: PlacesServiceStatus,
      ) => void,
    ) => void;
  };
  PlacesService: new (attribution: HTMLElement) => {
    getDetails: (
      request: { placeId: string; fields: string[] },
      callback: (
        place: PlaceResult | null,
        status: PlacesServiceStatus,
      ) => void,
    ) => void;
  };
  PlacesServiceStatus: {
    OK: string;
    ZERO_RESULTS: string;
  };
};

type GoogleMapsWindow = Window & {
  google?: {
    maps?: {
      places?: GooglePlacesNamespace;
      Geocoder?: new () => {
        geocode: (
          request: { location: { lat: number; lng: number } },
          callback: (
            results: Array<{
              formatted_address?: string;
              address_components?: AddressComponent[];
              geometry?: {
                location?: {
                  lat: () => number;
                  lng: () => number;
                };
              };
            }> | null,
            status: string,
          ) => void,
        ) => void;
      };
      GeocoderStatus?: { OK: string };
    };
  };
  __rsGooglePlacesPromise?: Promise<GooglePlacesNamespace>;
};

function getApiKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY?.trim() || "";
}

/** Load Maps JS + Places library once (works with browser-restricted API keys). */
export function loadGooglePlaces(): Promise<GooglePlacesNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Places is only available in the browser."));
  }

  const win = window as GoogleMapsWindow;
  if (win.google?.maps?.places) {
    return Promise.resolve(win.google.maps.places);
  }
  if (win.__rsGooglePlacesPromise) return win.__rsGooglePlacesPromise;

  const key = getApiKey();
  if (!key) {
    return Promise.reject(new Error("Google Places API key is not configured."));
  }

  win.__rsGooglePlacesPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-rs-google-places="true"]',
    );
    if (existing) {
      existing.addEventListener("load", () => {
        if (win.google?.maps?.places) resolve(win.google.maps.places);
        else reject(new Error("Google Places failed to load."));
      });
      existing.addEventListener("error", () =>
        reject(new Error("Google Places failed to load.")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&language=en`;
    script.async = true;
    script.defer = true;
    script.dataset.rsGooglePlaces = "true";
    script.onload = () => {
      if (win.google?.maps?.places) resolve(win.google.maps.places);
      else reject(new Error("Google Places failed to load."));
    };
    script.onerror = () => reject(new Error("Google Places failed to load."));
    document.head.appendChild(script);
  });

  return win.__rsGooglePlacesPromise;
}

function mapPredictions(
  predictions: AutocompletePrediction[],
): PlaceSuggestion[] {
  return predictions.map((prediction) => ({
    id: prediction.place_id,
    placeId: prediction.place_id,
    description: prediction.description,
    mainText: prediction.structured_formatting?.main_text || prediction.description,
    secondaryText: prediction.structured_formatting?.secondary_text || "",
  }));
}

/**
 * Full street-address suggestions via Google Places AutocompleteService.
 * Uses `types: ['address']` so results include house/building + street, not cities alone.
 */
export async function searchGoogleAddresses(
  query: string,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  if (signal?.aborted) return [];

  const places = await loadGooglePlaces();
  if (signal?.aborted) return [];

  const service = new places.AutocompleteService();

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      resolve([]);
      return;
    }

    const onAbort = () => resolve([]);
    signal?.addEventListener("abort", onAbort, { once: true });

    service.getPlacePredictions(
      {
        input: trimmed,
        types: ["address"],
      },
      (predictions, status) => {
        signal?.removeEventListener("abort", onAbort);
        if (signal?.aborted) {
          resolve([]);
          return;
        }

        if (
          status === places.PlacesServiceStatus.ZERO_RESULTS ||
          !predictions?.length
        ) {
          resolve([]);
          return;
        }

        if (status !== places.PlacesServiceStatus.OK) {
          reject(new Error(`Google Places autocomplete failed (${status})`));
          return;
        }

        resolve(mapPredictions(predictions));
      },
    );
  });
}

function parseAddressComponents(
  components: AddressComponent[] | undefined,
): Pick<PlaceAddress, "streetAddress" | "city" | "state" | "zipCode" | "country"> {
  const list = components ?? [];
  const get = (type: string, short = false) => {
    const match = list.find((item) => item.types.includes(type));
    if (!match) return "";
    return (short ? match.short_name : match.long_name).trim();
  };

  const streetNumber = get("street_number");
  const route = get("route");
  const streetAddress = [streetNumber, route].filter(Boolean).join(" ").trim();

  const city =
    get("locality") ||
    get("postal_town") ||
    get("sublocality") ||
    get("administrative_area_level_2");

  return {
    streetAddress,
    city,
    state: get("administrative_area_level_1", true),
    zipCode: get("postal_code"),
    country: get("country", true),
  };
}

/** Resolve place_id into structured address fields via PlacesService.getDetails. */
export async function getGooglePlaceDetails(
  placeId: string,
  signal?: AbortSignal,
): Promise<PlaceAddress> {
  if (!placeId.trim()) {
    throw new Error("placeId is required.");
  }
  if (signal?.aborted) {
    throw new Error("Aborted");
  }

  const places = await loadGooglePlaces();
  if (signal?.aborted) throw new Error("Aborted");

  const attribution = document.createElement("div");
  const service = new places.PlacesService(attribution);

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }

    const onAbort = () => reject(new Error("Aborted"));
    signal?.addEventListener("abort", onAbort, { once: true });

    service.getDetails(
      {
        placeId,
        fields: ["address_component", "formatted_address", "geometry"],
      },
      (place, status) => {
        signal?.removeEventListener("abort", onAbort);
        if (signal?.aborted) {
          reject(new Error("Aborted"));
          return;
        }

        if (status !== places.PlacesServiceStatus.OK || !place) {
          reject(new Error(`Google Places details failed (${status})`));
          return;
        }

        const parsed = parseAddressComponents(place.address_components);
        const lat = place.geometry?.location?.lat();
        const lng = place.geometry?.location?.lng();
        const formattedAddress =
          place.formatted_address?.trim() || parsed.streetAddress;

        resolve({
          formattedAddress,
          streetAddress: parsed.streetAddress || formattedAddress,
          city: parsed.city,
          state: parsed.state,
          zipCode: parsed.zipCode,
          country: parsed.country,
          latitude: typeof lat === "number" ? lat : null,
          longitude: typeof lng === "number" ? lng : null,
        });
      },
    );
  });
}

/** Reverse-geocode lat/lng via Google Geocoder into the same PlaceAddress shape. */
export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<PlaceAddress> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Invalid coordinates.");
  }
  if (signal?.aborted) throw new Error("Aborted");

  // Ensures Maps JS (Geocoder) is loaded.
  await loadGooglePlaces();
  if (signal?.aborted) throw new Error("Aborted");

  const win = window as GoogleMapsWindow;
  const Geocoder = win.google?.maps?.Geocoder;
  if (!Geocoder) {
    throw new Error("Google Geocoder is unavailable.");
  }

  const geocoder = new Geocoder();

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }

    const onAbort = () => reject(new Error("Aborted"));
    signal?.addEventListener("abort", onAbort, { once: true });

    geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
      signal?.removeEventListener("abort", onAbort);
      if (signal?.aborted) {
        reject(new Error("Aborted"));
        return;
      }

      const ok = win.google?.maps?.GeocoderStatus?.OK ?? "OK";
      if (status !== ok || !results?.length) {
        reject(new Error(`Could not resolve current location (${status})`));
        return;
      }

      const result = results[0];
      const parsed = parseAddressComponents(result.address_components);
      const lat = result.geometry?.location?.lat() ?? latitude;
      const lng = result.geometry?.location?.lng() ?? longitude;
      const formattedAddress =
        result.formatted_address?.trim() || parsed.streetAddress;

      resolve({
        formattedAddress,
        streetAddress: parsed.streetAddress || formattedAddress,
        city: parsed.city,
        state: parsed.state,
        zipCode: parsed.zipCode,
        country: parsed.country,
        latitude: typeof lat === "number" ? lat : latitude,
        longitude: typeof lng === "number" ? lng : longitude,
      });
    });
  });
}
