"use client";

/**
 * Single shared Google Places Autocomplete component.
 *
 * Canonical implementation for the whole app — import this (or the
 * `AddressAutocomplete` re-export) wherever address autocomplete is needed.
 * Behavior follows binsapp `GOOGLE_AUTOCOMPLETE.md`:
 * - Client-side `google.maps.places.Autocomplete` (no REST for the UI)
 * - No `types` filter, no country restriction
 * - Existing `.env` key via `getGoogleMapsApiKey()` / `loadGoogleMapsScript()`
 * - On select: street/place line only in the input; city / state / ZIP / lat / lng
 *   returned separately via `onSelect` for the surrounding form
 *
 * Does not touch API routes or request payloads.
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  getGoogleMapsApiKey,
  isGoogleMapsReady,
  loadGoogleMapsScript,
} from "@/lib/google-maps";
import {
  placeAddressFromGooglePlace,
  reverseGeocodeCoordinates,
  type PlaceAddress,
} from "@/lib/google-places";
import { placeCityLabel } from "@/store/locationSlice";
import { cn } from "@/lib/utils";

export type { PlaceAddress };
/** @deprecated Prefer PlaceAddress — kept for existing call sites. */
export type MapboxAddress = PlaceAddress;

const LOG = "[Google Autocomplete]";

type GooglePlaceResult = {
  formatted_address?: string;
  name?: string;
  place_id?: string;
  address_components?: Array<{
    long_name?: string;
    short_name?: string;
    types?: string[];
  }>;
  geometry?: { location?: { lat: () => number; lng: () => number } };
};

type GoogleAutocomplete = {
  addListener: (event: string, handler: () => void) => { remove: () => void };
  getPlace: () => GooglePlaceResult;
};

type GoogleAutocompleteService = {
  getPlacePredictions: (
    request: { input: string },
    callback: (
      predictions: Array<{
        description?: string;
        place_id?: string;
        structured_formatting?: {
          main_text?: string;
          secondary_text?: string;
        };
      }> | null,
      status: string,
    ) => void,
  ) => void;
};

export type GoogleAddressAutocompleteProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  /** Parsed street / city / state / zip / lat / lng for the parent form. */
  onSelect: (address: PlaceAddress) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  /** Hide helper/error text (e.g. compact search bars). */
  hideStatus?: boolean;
  /**
   * City / ZIP search fields: fill the input with "City, ST" (or ZIP),
   * not the street line.
   */
  preferCityDisplay?: boolean;
  "aria-invalid"?: boolean;
};

function streetDisplayFromParsed(parsed: PlaceAddress): string {
  return (
    parsed.streetAddress.trim() ||
    parsed.formattedAddress.split(",")[0]?.trim() ||
    ""
  );
}

function logParsedFields(parsed: PlaceAddress, source: string) {
  console.log(`${LOG} Parsed fields (${source}):`, {
    Address: parsed.streetAddress,
    City: parsed.city,
    State: parsed.state,
    ZIP: parsed.zipCode,
    Country: parsed.country,
    Latitude: parsed.latitude,
    Longitude: parsed.longitude,
    FormattedAddress: parsed.formattedAddress,
  });
  console.log(`${LOG} Parsed Address:`, parsed.streetAddress);
  console.log(`${LOG} Parsed City:`, parsed.city);
  console.log(`${LOG} Parsed State:`, parsed.state);
  console.log(`${LOG} Parsed ZIP:`, parsed.zipCode);
  console.log(`${LOG} Latitude:`, parsed.latitude);
  console.log(`${LOG} Longitude:`, parsed.longitude);
}

/**
 * Shared Google address autocomplete.
 * Only handles Places selection + parsing; parent forms own City/State/ZIP UI.
 */
export function GoogleAddressAutocomplete({
  id,
  name,
  value,
  onChange,
  onSelect,
  placeholder = "Start typing a street address (number + street)…",
  autoComplete = "off",
  required,
  disabled,
  className,
  inputClassName,
  hideStatus = false,
  preferCityDisplay = false,
  "aria-invalid": ariaInvalid,
}: GoogleAddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<GoogleAutocomplete | null>(null);
  const autocompleteServiceRef = useRef<GoogleAutocompleteService | null>(null);
  const listenerRef = useRef<{ remove: () => void } | null>(null);
  const predictionsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const preferCityRef = useRef(preferCityDisplay);
  const onChangeRef = useRef(onChange);
  const onSelectRef = useRef(onSelect);

  const [mapsReady, setMapsReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  preferCityRef.current = preferCityDisplay;
  onChangeRef.current = onChange;
  onSelectRef.current = onSelect;

  // Load Maps JS + Places once (existing NEXT_PUBLIC_GOOGLE_* key only).
  useEffect(() => {
    let cancelled = false;
    if (!getGoogleMapsApiKey()) {
      setError("Google Places API key is not configured.");
      return;
    }
    void loadGoogleMapsScript()
      .then(() => {
        if (!cancelled) setMapsReady(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Google Maps failed to load.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the DOM input in sync with external value without blocking typing
  // (fully controlled `value=` fights Google's Autocomplete).
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    if (document.activeElement === input) return;
    if (input.value !== value) input.value = value;
  }, [value]);

  // Attach native Autocomplete — no `types`, no country restriction (MD §6).
  useEffect(() => {
    if (!mapsReady || !inputRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const googleMaps = (window as any).google?.maps;
    if (!googleMaps?.places?.Autocomplete) return;

    if (!autocompleteServiceRef.current && googleMaps.places.AutocompleteService) {
      autocompleteServiceRef.current =
        new googleMaps.places.AutocompleteService() as GoogleAutocompleteService;
    }

    if (autocompleteRef.current) return;

    const autocomplete = new googleMaps.places.Autocomplete(inputRef.current, {
      fields: ["formatted_address", "address_components", "geometry", "name", "place_id"],
    }) as GoogleAutocomplete;
    autocompleteRef.current = autocomplete;

    listenerRef.current = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      console.log(`${LOG} Place selected (raw Google place):`, place);
      console.log(`${LOG} Complete selected Google place data:`, {
        name: place.name,
        place_id: place.place_id,
        formatted_address: place.formatted_address,
        address_components: place.address_components,
        geometry: place.geometry
          ? {
              lat: place.geometry.location?.lat?.(),
              lng: place.geometry.location?.lng?.(),
            }
          : null,
      });

      const parsed = placeAddressFromGooglePlace(place);
      if (!parsed) {
        console.log(`${LOG} Could not parse selected place — missing geometry.`);
        setError("Could not read that place — try another suggestion.");
        return;
      }

      logParsedFields(parsed, "place_changed");

      const streetLine = streetDisplayFromParsed(parsed);
      const display = preferCityRef.current
        ? placeCityLabel(parsed) ||
          [parsed.city, parsed.state].filter(Boolean).join(", ") ||
          streetLine ||
          parsed.formattedAddress
        : streetLine;

      console.log(`${LOG} Input display value after select:`, display);

      if (inputRef.current) {
        inputRef.current.value = display;
      }
      onChangeRef.current(display);

      const payload: PlaceAddress = {
        ...parsed,
        streetAddress: parsed.streetAddress || streetLine,
      };
      console.log(`${LOG} onSelect payload returned to form:`, payload);
      onSelectRef.current(payload);

      setError(
        parsed.zipCode
          ? null
          : "No postal code found for this place — please enter it manually if needed.",
      );
    });

    return () => {
      listenerRef.current?.remove();
      listenerRef.current = null;
      autocompleteRef.current = null;
    };
  }, [mapsReady]);

  useEffect(() => {
    return () => {
      if (predictionsTimerRef.current) {
        clearTimeout(predictionsTimerRef.current);
      }
    };
  }, []);

  function logSuggestionsForQuery(query: string) {
    const service = autocompleteServiceRef.current;
    if (!service || query.trim().length < 2) {
      if (query.trim().length < 2) {
        console.log(`${LOG} Suggestions: (query too short)`, []);
      }
      return;
    }

    service.getPlacePredictions({ input: query }, (predictions, status) => {
      console.log(`${LOG} Suggestions status:`, status);
      console.log(
        `${LOG} Suggestions Google returned:`,
        (predictions ?? []).map((item) => ({
          description: item.description,
          place_id: item.place_id,
          main_text: item.structured_formatting?.main_text,
          secondary_text: item.structured_formatting?.secondary_text,
        })),
      );
    });
  }

  function handleInputChange(next: string) {
    console.log(`${LOG} User typing:`, next);
    onChange(next);

    if (predictionsTimerRef.current) {
      clearTimeout(predictionsTimerRef.current);
    }
    predictionsTimerRef.current = setTimeout(() => {
      logSuggestionsForQuery(next);
    }, 250);
  }

  function applyResolvedAddress(address: PlaceAddress, source: string) {
    console.log(`${LOG} Resolved address (${source}):`, address);
    logParsedFields(address, source);

    const streetLine = streetDisplayFromParsed(address);
    const display = preferCityDisplay
      ? placeCityLabel(address) ||
        [address.city, address.state].filter(Boolean).join(", ") ||
        streetLine ||
        address.formattedAddress
      : streetLine;

    if (inputRef.current) inputRef.current.value = display;
    onChange(display);

    const payload: PlaceAddress = {
      ...address,
      streetAddress: address.streetAddress.trim() || streetLine,
    };
    console.log(`${LOG} onSelect payload returned to form:`, payload);
    onSelect(payload);

    setError(
      address.zipCode
        ? null
        : "No postal code found for this place — please enter it manually if needed.",
    );
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }

    setLocating(true);
    setError(null);
    console.log(`${LOG} Use current location requested.`);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12_000,
          maximumAge: 60_000,
        });
      });

      const { latitude, longitude } = position.coords;
      console.log(`${LOG} Geolocation coords:`, { latitude, longitude });

      // Prefer JS Geocoder when Maps is ready (MD §10); else REST proxy.
      if (isGoogleMapsReady()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const geocoder = new (window as any).google.maps.Geocoder();
        const response = await new Promise<{
          results?: Array<{
            formatted_address?: string;
            name?: string;
            address_components?: GooglePlaceResult["address_components"];
            geometry?: {
              location?: { lat: () => number; lng: () => number };
              location_type?: string;
            };
          }>;
        }>((resolve, reject) => {
          geocoder.geocode(
            { location: { lat: latitude, lng: longitude } },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (results: any, status: string) => {
              if (status === "OK" && results?.length) resolve({ results });
              else reject(new Error("Could not resolve current location."));
            },
          );
        });

        const results = response.results ?? [];
        const picked =
          results.find((item) => item.geometry?.location_type === "ROOFTOP") ??
          results[0];
        console.log(`${LOG} Reverse-geocode result:`, picked);
        const parsed = placeAddressFromGooglePlace({
          formatted_address: picked?.formatted_address,
          name: picked?.name,
          address_components: picked?.address_components,
          geometry: {
            location: {
              lat: () => latitude,
              lng: () => longitude,
            },
          },
        });
        if (!parsed) throw new Error("Could not resolve current location.");
        applyResolvedAddress(parsed, "current_location");
      } else {
        const address = await reverseGeocodeCoordinates(latitude, longitude);
        applyResolvedAddress(address, "current_location_rest");
      }
    } catch (err) {
      const message =
        err && typeof err === "object" && "code" in err
          ? (err as GeolocationPositionError).code === 1
            ? "Location permission denied. Allow location access and try again."
            : (err as GeolocationPositionError).code === 3
              ? "Timed out while getting your location. Try again."
              : "Could not get your current location."
          : err instanceof Error
            ? err.message
            : "Could not get your current location.";
      console.log(`${LOG} Current location error:`, message, err);
      setError(message);
    } finally {
      setLocating(false);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <MapPin
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          id={id}
          name={name}
          defaultValue={value}
          onChange={(event) => {
            handleInputChange(event.target.value);
          }}
          placeholder={placeholder}
          autoComplete={autoComplete || "off"}
          required={required}
          disabled={disabled || locating}
          aria-invalid={ariaInvalid || undefined}
          className={cn("pr-10 pl-8", inputClassName)}
        />
        {locating ? (
          <Loader2
            className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        ) : (
          <button
            type="button"
            className="absolute top-1/2 right-1.5 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            title="Use current location"
            aria-label="Use current location"
            disabled={disabled}
            onClick={() => void useCurrentLocation()}
          >
            <LocateFixed className="size-4" />
          </button>
        )}
      </div>

      {!hideStatus && error ? (
        <p className="mt-1.5 text-xs text-muted-foreground" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Alias used by existing call sites — same component. */
export const AddressAutocomplete = GoogleAddressAutocomplete;
