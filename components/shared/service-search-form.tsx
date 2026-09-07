"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ServiceSuggestionList } from "@/components/shared/service-suggestion-list";
import {
  extractZip,
  resolveSearchIntent,
  servicesHref,
  suggestServices,
  type SearchIntent,
  type ServiceMatch,
} from "@/lib/search";
import { cn } from "@/lib/utils";

type PlaceSuggestion = {
  label: string;
  city: string;
  state?: string;
  zip?: string;
};

function displayPlace(place: PlaceSuggestion) {
  const city = place.city.split(",")[0]?.trim() ?? "";
  return city && !/^\d{5}$/.test(city) ? city : place.city;
}

export function ServiceSearchForm({
  defaultCategory,
  defaultZip,
  defaultLocation,
  variant = "hero",
  onSearch,
  onLocationResolved,
}: {
  defaultCategory?: string;
  defaultZip?: string;
  defaultLocation?: string;
  variant?: "hero" | "compact";
  onSearch?: (intent: SearchIntent) => void | Promise<void>;
  onLocationResolved?: (location: string, zip: string) => void;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState(defaultCategory ?? "");
  const [location, setLocation] = useState(defaultLocation || defaultZip || "");
  const [zip, setZip] = useState(defaultZip && /^\d{5}$/.test(defaultZip) ? defaultZip : "");
  const [error, setError] = useState("");
  const [serviceHits, setServiceHits] = useState<ServiceMatch[]>([]);
  const [placeHits, setPlaceHits] = useState<PlaceSuggestion[]>([]);
  const [openList, setOpenList] = useState<"service" | "place" | null>(null);
  const [activeService, setActiveService] = useState(0);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpenList(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function applyLocation(nextLocation: string, nextZip = "") {
    setLocation(nextLocation);
    setZip(nextZip);
    onLocationResolved?.(nextLocation, nextZip);
  }

  useEffect(() => {
    if (defaultZip || defaultLocation || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const params = new URLSearchParams({
          lat: String(position.coords.latitude),
          lon: String(position.coords.longitude),
        });
        const response = await fetch(`/api/places?${params}`);
        if (!response.ok) return;
        const data = (await response.json()) as { places?: PlaceSuggestion[] };
        const place = data.places?.[0];
        if (!place) return;
        applyLocation(displayPlace(place), place.zip ?? "");
      },
      () => undefined,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 }
    );
  }, [defaultLocation, defaultZip]);

  useEffect(() => {
    const q = location.trim();
    if (q.length < 2 || openList !== "place") {
      setPlaceHits([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
      if (!response.ok) return;
      const data = (await response.json()) as { places?: PlaceSuggestion[] };
      setPlaceHits(data.places ?? []);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [location, openList]);

  function chooseService(hit: ServiceMatch) {
    setQuery(hit.label);
    setServiceHits([]);
    setOpenList(null);
    void goToResults(hit, hit.label);
  }

  function refreshServiceHits(value: string) {
    const hits = suggestServices(value) ?? [];
    setServiceHits(hits);
    setActiveService(0);
    setOpenList(hits.length ? "service" : null);
  }

  function onServiceKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (openList !== "service" || !serviceHits.length) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveService((index) => (index + 1) % serviceHits.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveService((index) => (index - 1 + serviceHits.length) % serviceHits.length);
        break;
      case "Enter":
        if (serviceHits[activeService]) {
          event.preventDefault();
          chooseService(serviceHits[activeService]);
        }
        break;
      case "Escape":
        event.preventDefault();
        setOpenList(null);
        break;
      default:
        break;
    }
  }

  function choosePlace(place: PlaceSuggestion) {
    applyLocation(displayPlace(place), place.zip ?? extractZip(place.label) ?? "");
    setPlaceHits([]);
    setOpenList(null);
  }

  async function resolveZip(value: string) {
    const typedZip = extractZip(value);
    if (typedZip) return typedZip;
    if (zip) return zip;
    if (value.trim().length < 2) return "";

    const response = await fetch(`/api/places?q=${encodeURIComponent(value.trim())}`);
    if (!response.ok) return "";
    const data = (await response.json()) as { places?: PlaceSuggestion[] };
    return data.places?.[0]?.zip ?? "";
  }

  async function goToResults(match: ServiceMatch | undefined, nextQuery: string) {
    const nextZip = await resolveZip(location);
    if (!nextQuery.trim() && !nextZip && !location.trim()) {
      setError("Tell us what you need or the city / ZIP.");
      return;
    }

    setError("");
    const intent = resolveSearchIntent({
      query: nextQuery,
      picked: match,
      zip: nextZip,
      location,
    });
    if (onSearch) {
      await onSearch(intent);
      return;
    }
    router.push(servicesHref(intent));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await goToResults(undefined, query);
  }

  const serviceField = (
    <div className="relative min-w-0 flex-1">
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id={variant === "hero" ? "hero-service" : "service-query"}
        name="q"
        value={query}
        placeholder="What are you looking for?"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={openList === "service" && serviceHits.length > 0}
        aria-controls={variant === "hero" ? "hero-service-suggestions" : "service-query-suggestions"}
        aria-activedescendant={
          openList === "service" && serviceHits[activeService]
            ? `${variant}-service-option-${activeService}`
            : undefined
        }
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          refreshServiceHits(value);
        }}
        onFocus={() => {
          if (query.trim().length >= 2) refreshServiceHits(query);
        }}
        onKeyDown={onServiceKeyDown}
        className={cn(
          "border-0 bg-transparent pl-10 font-medium placeholder:font-normal focus-visible:ring-0",
          variant === "hero" ? "h-9" : "h-11"
        )}
      />
      {openList === "service" && serviceHits.length ? (
        <ServiceSuggestionList
          id={variant === "hero" ? "hero-service-suggestions" : "service-query-suggestions"}
          hits={serviceHits}
          query={query}
          activeIndex={activeService}
          optionIdPrefix={`${variant}-service-option`}
          onHover={setActiveService}
          onChoose={chooseService}
        />
      ) : null}
    </div>
  );

  const locationField = (
    <div
      className={cn(
        "relative min-w-0",
        variant === "hero" ? "sm:w-[11.5rem] sm:shrink-0 sm:flex-none" : "sm:min-w-[15.5rem] sm:flex-[1.15]"
      )}
    >
      <MapPin
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id={variant === "hero" ? "hero-location" : "service-location"}
        name="location"
        value={location}
        placeholder="City / ZIP code"
        autoComplete="off"
        aria-invalid={Boolean(error)}
        onChange={(event) => {
          const value = event.target.value;
          applyLocation(value, extractZip(value) ?? "");
          setOpenList("place");
        }}
        onFocus={() => setOpenList("place")}
        className={cn(
          "border-0 bg-transparent pl-10 font-medium placeholder:font-normal focus-visible:ring-0",
          variant === "hero" ? "h-9" : "h-11"
        )}
      />
      {openList === "place" && placeHits.length ? (
        <ul className="absolute top-[calc(100%+0.4rem)] right-0 z-50 w-[min(100vw-2rem,18rem)] overflow-hidden rounded-xl border bg-card py-1 shadow-lg">
          {placeHits.map((place) => (
            <li key={place.label}>
              <button
                type="button"
                className="flex w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => choosePlace(place)}
              >
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  if (variant === "hero") {
    return (
      <form ref={rootRef} onSubmit={onSubmit} className="relative z-20 w-full">
        <div className="relative flex flex-col gap-1.5 rounded-xl border border-foreground/35 bg-card p-1.5 text-card-foreground elevate-lg sm:flex-row sm:items-center">
          {serviceField}
          <div className="h-px w-full shrink-0 bg-border sm:h-5 sm:w-px" aria-hidden="true" />
          {locationField}
          <Button type="submit" size="lg" className="shrink-0 sm:w-auto">
            <Search data-icon="inline-start" />
            Search
          </Button>
        </div>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <form
      ref={rootRef}
      onSubmit={onSubmit}
      className="w-full rounded-xl border bg-card p-4 text-card-foreground elevate"
    >
      <FieldGroup className="gap-3 md:flex-row md:items-end">
        <Field className="md:flex-1">
          <FieldLabel htmlFor="service-query">What are you looking for?</FieldLabel>
          {serviceField}
        </Field>
        <Field className="md:max-w-56">
          <FieldLabel htmlFor="service-location">City / ZIP code</FieldLabel>
          {locationField}
        </Field>
        <Button type="submit" size="xl" className="h-11 w-full md:w-auto">
          <Search data-icon="inline-start" />
          Find professionals
        </Button>
      </FieldGroup>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
