"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, LocateFixed, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  getGooglePlaceDetails,
  reverseGeocodeCoordinates,
  searchGoogleAddresses,
  type PlaceAddress,
  type PlaceSuggestion,
} from "@/lib/google-places";
import { cn } from "@/lib/utils";

export type { PlaceAddress };
/** @deprecated Prefer PlaceAddress — kept for existing call sites. */
export type MapboxAddress = PlaceAddress;

type AddressAutocompleteProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: PlaceAddress) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  "aria-invalid"?: boolean;
};

export function AddressAutocomplete({
  id,
  name,
  value,
  onChange,
  onSelect,
  placeholder = "Start typing a street address (number + street)…",
  autoComplete = "street-address",
  required,
  disabled,
  className,
  inputClassName,
  "aria-invalid": ariaInvalid,
}: AddressAutocompleteProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  /** Only search/open dropdown while the user is actively typing — never on hydrate/focus/select. */
  const userTypingRef = useRef(false);
  const skipSearchRef = useRef(false);

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }

    // Do not query Google or open the list unless the user just typed.
    if (!userTypingRef.current) {
      return;
    }

    const query = value.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      setError(null);
      return;
    }

    if (!process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY?.trim()) {
      setError("Address search is unavailable. Enter your address manually.");
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await searchGoogleAddresses(query, controller.signal);
        if (controller.signal.aborted) return;
        // User may have selected / left while the request was in flight.
        if (!userTypingRef.current) {
          setSuggestions([]);
          setOpen(false);
          return;
        }
        setSuggestions(results);
        setOpen(results.length > 0);
        setActiveIndex(-1);
      } catch (err) {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setOpen(false);
        setError(
          err instanceof Error
            ? err.message
            : "Could not load address suggestions.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        userTypingRef.current = false;
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function closeSuggestions() {
    userTypingRef.current = false;
    skipSearchRef.current = true;
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  }

  function applyResolvedAddress(address: PlaceAddress, source: string) {
    // Temporary debug — inspect Google Places / Geocoder payload shape.
    console.log(`[AddressAutocomplete] ${source} location object:`, address);
    closeSuggestions();
    onChange(address.formattedAddress || address.streetAddress);
    onSelect(address);
    setError(
      address.zipCode
        ? null
        : "No postal code found for this place — please enter it manually if needed.",
    );
  }

  async function choose(suggestion: PlaceSuggestion) {
    closeSuggestions();
    onChange(suggestion.description);
    setResolving(true);
    setError(null);

    try {
      const address = await getGooglePlaceDetails(suggestion.placeId);
      applyResolvedAddress(address, "autocomplete");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load the selected address details.",
      );
    } finally {
      setResolving(false);
    }
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }

    setLocating(true);
    setError(null);
    closeSuggestions();

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12_000,
          maximumAge: 60_000,
        });
      });

      const { latitude, longitude } = position.coords;
      const address = await reverseGeocodeCoordinates(latitude, longitude);
      applyResolvedAddress(address, "current-location");
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

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      void choose(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      closeSuggestions();
    }
  }

  const busy = loading || resolving || locating;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={id}
          name={name}
          value={value}
          onChange={(event) => {
            userTypingRef.current = true;
            onChange(event.target.value);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled || resolving || locating}
          aria-invalid={ariaInvalid || undefined}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open && suggestions.length > 0}
          role="combobox"
          className={cn("pr-10 pl-8", inputClassName)}
        />
        {busy ? (
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

      {open && suggestions.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-[calc(100%+0.35rem)] right-0 left-0 z-50 max-h-64 overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.id} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm transition-colors",
                  index === activeIndex
                    ? "bg-primary/10 text-foreground"
                    : "hover:bg-muted/70",
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => void choose(suggestion)}
              >
                <span className="font-medium">
                  {suggestion.mainText || suggestion.description}
                </span>
                {suggestion.secondaryText ? (
                  <span className="text-xs text-muted-foreground">
                    {suggestion.secondaryText}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="mt-1.5 text-xs text-muted-foreground" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
