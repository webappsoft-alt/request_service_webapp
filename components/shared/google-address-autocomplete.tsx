/* eslint-disable react-hooks/set-state-in-effect */
"use client";

/**
 * Single shared Google Places Autocomplete component.
 *
 * Uses AutocompleteService + PlacesService with a React-owned dropdown
 * (not Google's .pac-container) so suggestion clicks work inside Radix
 * dialogs / sheets everywhere in the app.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
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

type Prediction = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
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

type GooglePlacesService = {
  getDetails: (
    request: { placeId: string; fields: string[] },
    callback: (place: GooglePlaceResult | null, status: string) => void,
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
  /** Home search only: fill with "City, ZIP" instead of "City, ST". */
  preferCityZipDisplay?: boolean;
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
  preferCityZipDisplay = false,
  "aria-invalid": ariaInvalid,
}: GoogleAddressAutocompleteProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionTokenRef = useRef<unknown>(null);
  const autocompleteServiceRef = useRef<GoogleAutocompleteService | null>(null);
  const placesServiceRef = useRef<GooglePlacesService | null>(null);
  const placesAttrRef = useRef<HTMLDivElement | null>(null);
  const predictionsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectingRef = useRef(false);
  const preferCityRef = useRef(preferCityDisplay);
  const preferCityZipRef = useRef(preferCityZipDisplay);
  const onChangeRef = useRef(onChange);
  const onSelectRef = useRef(onSelect);

  const [mapsReady, setMapsReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Prediction[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  preferCityRef.current = preferCityDisplay;
  preferCityZipRef.current = preferCityZipDisplay;
  onChangeRef.current = onChange;
  onSelectRef.current = onSelect;

  const updateMenuPosition = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    const rect = input.getBoundingClientRect();
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 240),
      zIndex: 300000,
    });
  }, []);

  // Load Maps JS + Places once.
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

  // Init Places services (no native Autocomplete widget / .pac-container).
  useEffect(() => {
    if (!mapsReady) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const googleMaps = (window as any).google?.maps;
    if (!googleMaps?.places) return;

    if (!autocompleteServiceRef.current && googleMaps.places.AutocompleteService) {
      autocompleteServiceRef.current =
        new googleMaps.places.AutocompleteService() as GoogleAutocompleteService;
    }

    if (!placesServiceRef.current && googleMaps.places.PlacesService) {
      if (!placesAttrRef.current) {
        const el = document.createElement("div");
        el.setAttribute("aria-hidden", "true");
        el.style.display = "none";
        document.body.appendChild(el);
        placesAttrRef.current = el;
      }
      placesServiceRef.current = new googleMaps.places.PlacesService(
        placesAttrRef.current,
      ) as GooglePlacesService;
    }

    if (googleMaps.places.AutocompleteSessionToken) {
      sessionTokenRef.current = new googleMaps.places.AutocompleteSessionToken();
    }

    return () => {
      if (placesAttrRef.current?.parentNode) {
        placesAttrRef.current.parentNode.removeChild(placesAttrRef.current);
        placesAttrRef.current = null;
      }
      placesServiceRef.current = null;
      autocompleteServiceRef.current = null;
    };
  }, [mapsReady]);

  useEffect(() => {
    return () => {
      if (predictionsTimerRef.current) clearTimeout(predictionsTimerRef.current);
      if (blurCloseTimerRef.current) clearTimeout(blurCloseTimerRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onReposition = () => updateMenuPosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, suggestions.length, updateMenuPosition]);

  // Close when interacting outside input + menu. Selection itself is handled on
  // the option's pointerdown — preventDefault there suppresses the later click
  // event, so we must not rely on click for choosing a suggestion.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      const menu = document.getElementById(listboxId);
      if (menu?.contains(target)) {
        if (blurCloseTimerRef.current) {
          clearTimeout(blurCloseTimerRef.current);
          blurCloseTimerRef.current = null;
        }
        return;
      }
      setOpen(false);
      setActiveIndex(-1);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, listboxId]);

  // Keep the portaled menu interactive inside Radix dialogs (body can get
  // pointer-events:none / inert while the modal is open).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let raf = 0;
    const unlock = () => {
      if (cancelled) return;
      const menu = document.getElementById(listboxId);
      if (menu) {
        menu.removeAttribute("inert");
        menu.removeAttribute("aria-hidden");
        if (menu.style.pointerEvents !== "auto") {
          menu.style.pointerEvents = "auto";
        }
      }
      raf = window.requestAnimationFrame(unlock);
    };
    raf = window.requestAnimationFrame(unlock);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [open, listboxId]);

  function displayFromParsed(parsed: PlaceAddress): string {
    const streetLine = streetDisplayFromParsed(parsed);
    if (preferCityZipRef.current) {
      const cityZip = [parsed.city, parsed.zipCode].filter(Boolean).join(", ");
      return (
        cityZip ||
        placeCityLabel(parsed) ||
        streetLine ||
        parsed.formattedAddress
      );
    }
    if (preferCityRef.current) {
      return (
        placeCityLabel(parsed) ||
        [parsed.city, parsed.state].filter(Boolean).join(", ") ||
        streetLine ||
        parsed.formattedAddress
      );
    }
    return streetLine;
  }

  function applyResolvedAddress(address: PlaceAddress, source: string) {
    console.log(`${LOG} Resolved address (${source}):`, address);
    logParsedFields(address, source);

    const display = displayFromParsed(address);
    if (inputRef.current) inputRef.current.value = display;
    onChangeRef.current(display);

    const payload: PlaceAddress = {
      ...address,
      streetAddress: address.streetAddress.trim() || streetDisplayFromParsed(address),
    };
    onSelectRef.current(payload);

    setOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
    setError(
      address.zipCode
        ? null
        : "No postal code found for this place — please enter it manually if needed.",
    );
  }

  function fetchSuggestions(query: string) {
    const service = autocompleteServiceRef.current;
    const trimmed = query.trim();
    if (!service || trimmed.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setLoadingSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const request: any = { input: trimmed };
    if (sessionTokenRef.current) {
      request.sessionToken = sessionTokenRef.current;
    }

    service.getPlacePredictions(request, (predictions, status) => {
      setLoadingSuggestions(false);
      console.log(`${LOG} Suggestions status:`, status);
      if (status !== "OK" || !predictions?.length) {
        setSuggestions([]);
        setOpen(trimmed.length >= 2);
        setActiveIndex(-1);
        return;
      }

      const next = predictions
        .map((item) => ({
          placeId: String(item.place_id || "").trim(),
          description: String(item.description || "").trim(),
          mainText: String(item.structured_formatting?.main_text || item.description || "").trim(),
          secondaryText: String(item.structured_formatting?.secondary_text || "").trim(),
        }))
        .filter((item) => item.placeId);

      setSuggestions(next);
      setOpen(next.length > 0);
      setActiveIndex(next.length ? 0 : -1);
      updateMenuPosition();
    });
  }

  function handleInputChange(next: string) {
    console.log(`${LOG} User typing:`, next);
    onChange(next);
    setError(null);

    if (predictionsTimerRef.current) clearTimeout(predictionsTimerRef.current);
    predictionsTimerRef.current = setTimeout(() => {
      fetchSuggestions(next);
    }, 220);
  }

  async function selectPrediction(prediction: Prediction) {
    if (!prediction.placeId || selectingRef.current || selecting) return;
    selectingRef.current = true;
    if (blurCloseTimerRef.current) {
      clearTimeout(blurCloseTimerRef.current);
      blurCloseTimerRef.current = null;
    }
    setSelecting(true);
    setError(null);
    console.log(`${LOG} Suggestion clicked:`, prediction);

    try {
      const place = await new Promise<GooglePlaceResult>((resolve, reject) => {
        const service = placesServiceRef.current;
        if (!service) {
          reject(new Error("Places service is not ready."));
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const request: any = {
          placeId: prediction.placeId,
          fields: [
            "formatted_address",
            "address_components",
            "geometry",
            "name",
            "place_id",
          ],
        };
        if (sessionTokenRef.current) {
          request.sessionToken = sessionTokenRef.current;
        }
        service.getDetails(request, (result, status) => {
          if (status === "OK" && result) resolve(result);
          else reject(new Error(`Could not load place details (${status}).`));
        });
      });

      // Refresh session token after a successful details fetch.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const googleMaps = (window as any).google?.maps;
      if (googleMaps?.places?.AutocompleteSessionToken) {
        sessionTokenRef.current = new googleMaps.places.AutocompleteSessionToken();
      }

      const parsed = placeAddressFromGooglePlace(place);
      if (!parsed) {
        setError("Could not read that place — try another suggestion.");
        return;
      }
      applyResolvedAddress(parsed, "suggestion_select");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not select that address.";
      console.log(`${LOG} Select error:`, message, err);
      setError(message);
    } finally {
      selectingRef.current = false;
      setSelecting(false);
    }
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }

    setLocating(true);
    setError(null);
    setOpen(false);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12_000,
          maximumAge: 60_000,
        });
      });

      const { latitude, longitude } = position.coords;

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
      setError(message);
    } finally {
      setLocating(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || !suggestions.length) {
      if (event.key === "Escape") setOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        index <= 0 ? suggestions.length - 1 : index - 1,
      );
      return;
    }
    if (event.key === "Enter" && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      void selectPrediction(suggestions[activeIndex]);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            id={listboxId}
            role="listbox"
            data-google-address-menu="true"
            style={menuStyle}
            className="overflow-hidden rounded-lg border border-input bg-popover text-popover-foreground shadow-lg"
            onMouseDown={(event) => {
              // Keep input focus so blur doesn't close the menu mid-select.
              event.preventDefault();
            }}
          >
            {loadingSuggestions && !suggestions.length ? (
              <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Searching addresses…
              </div>
            ) : null}

            {suggestions.map((item, index) => {
              const active = index === activeIndex;
              return (
                <button
                  key={item.placeId}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-place-id={item.placeId}
                  className={cn(
                    "flex w-full cursor-pointer items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                    active ? "bg-muted" : "hover:bg-muted/70",
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onPointerDown={(event) => {
                    // preventDefault keeps focus on the input (no blur), but that
                    // also suppresses the subsequent click — select here instead.
                    event.preventDefault();
                    event.stopPropagation();
                    if (blurCloseTimerRef.current) {
                      clearTimeout(blurCloseTimerRef.current);
                      blurCloseTimerRef.current = null;
                    }
                    void selectPrediction(item);
                  }}
                >
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 leading-snug">
                    <span className="block font-medium text-foreground">
                      {item.mainText}
                    </span>
                    {item.secondaryText ? (
                      <span className="block text-xs text-muted-foreground">
                        {item.secondaryText}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}

            {!loadingSuggestions && suggestions.length === 0 ? (
              <div className="px-3 py-2.5 text-xs text-muted-foreground">
                No matching addresses. Try a fuller street address.
              </div>
            ) : null}

            <div className="border-t border-input px-3 py-1.5 text-[10px] text-muted-foreground">
              Address suggestions powered by Google
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          id={id}
          name={name}
          value={value}
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={() => {
            if (blurCloseTimerRef.current) {
              clearTimeout(blurCloseTimerRef.current);
              blurCloseTimerRef.current = null;
            }
            if (value.trim().length >= 2) {
              fetchSuggestions(value);
            }
          }}
          onBlur={() => {
            blurCloseTimerRef.current = setTimeout(() => {
              setOpen(false);
              setActiveIndex(-1);
            }, 260);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete={autoComplete || "off"}
          required={required}
          disabled={disabled || locating || selecting}
          aria-invalid={ariaInvalid || undefined}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          role="combobox"
          className={cn("pr-10 pl-8", inputClassName)}
        />
        {locating || selecting ? (
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

      {menu}

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
