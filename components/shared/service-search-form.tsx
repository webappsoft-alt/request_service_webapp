"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  AddressAutocomplete,
  type PlaceAddress,
} from "@/components/shared/address-autocomplete";
import { ServiceSuggestionList } from "@/components/shared/service-suggestion-list";
import {
  resolveSearchIntent,
  servicesHref,
  suggestServices,
  type SearchIntent,
  type ServiceMatch,
} from "@/lib/search";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  detectCurrentLocation,
  hasLocation,
  hydrateLocationIfEmpty,
  locationDisplayLabel,
  setLocationAddress,
  setLocationFromPlace,
} from "@/store/locationSlice";

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
  const dispatch = useAppDispatch();
  const customerLocation = useAppSelector((state) => state.location);
  const rootRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState(defaultCategory ?? "");
  const [error, setError] = useState("");
  const [serviceHits, setServiceHits] = useState<ServiceMatch[]>([]);
  const [openList, setOpenList] = useState<"service" | null>(null);
  const [activeService, setActiveService] = useState(0);

  const locationLabel = locationDisplayLabel(customerLocation);
  const locationValue =
    customerLocation.address || customerLocation.city || customerLocation.zip || "";

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpenList(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // Seed Redux from URL/page defaults only when nothing is selected yet.
  useEffect(() => {
    if (defaultLocation || defaultZip) {
      dispatch(
        hydrateLocationIfEmpty({
          address: defaultLocation,
          city: defaultLocation,
          zip: defaultZip,
        }),
      );
    }
  }, [defaultLocation, defaultZip, dispatch]);

  // Default to the user's current location once per session (in-memory Redux).
  useEffect(() => {
    if (customerLocation.detectAttempted || customerLocation.detecting) return;
    if (hasLocation(customerLocation)) return;
    void dispatch(detectCurrentLocation());
  }, [
    customerLocation.address,
    customerLocation.city,
    customerLocation.zip,
    customerLocation.latitude,
    customerLocation.longitude,
    customerLocation.detectAttempted,
    customerLocation.detecting,
    dispatch,
  ]);

  function applyPlace(place: PlaceAddress) {
    dispatch(setLocationFromPlace(place));
    const next = {
      address: place.formattedAddress || place.streetAddress || "",
      zip: place.zipCode || "",
      city: place.city || "",
      state: place.state || "",
      country: place.country || "",
      latitude: place.latitude,
      longitude: place.longitude,
    };
    onLocationResolved?.(locationDisplayLabel(next), next.zip);
  }

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

  async function goToResults(match: ServiceMatch | undefined, nextQuery: string) {
    const nextZip = customerLocation.zip;
    const nextLocation = locationLabel || customerLocation.address || nextZip;
    if (!nextQuery.trim() && !nextZip && !nextLocation.trim()) {
      setError("Tell us what you need or the city / ZIP.");
      return;
    }

    setError("");
    const intent = resolveSearchIntent({
      query: nextQuery,
      picked: match,
      zip: nextZip,
      location: nextLocation,
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
        variant === "hero" ? "sm:w-[14.5rem] sm:shrink-0 sm:flex-none" : "sm:min-w-[15.5rem] sm:flex-[1.15]"
      )}
    >
      <AddressAutocomplete
        id={variant === "hero" ? "hero-location" : "service-location"}
        name="location"
        value={locationValue}
        onChange={(value) => dispatch(setLocationAddress(value))}
        onSelect={applyPlace}
        placeholder="City / ZIP code"
        autoComplete="off"
        hideStatus
        aria-invalid={Boolean(error)}
        inputClassName={cn(
          "border-0 bg-transparent font-medium placeholder:font-normal focus-visible:ring-0",
          variant === "hero" ? "h-9" : "h-11"
        )}
      />
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
        <Field className="md:max-w-72">
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
