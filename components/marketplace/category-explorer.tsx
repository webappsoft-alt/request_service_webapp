"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ProviderCard } from "@/components/shared/provider-card";
import { findMarketCity, stateLabel } from "@/lib/data/markets";
import { parsePlaceInput } from "@/lib/data/profile-explore";
import { extractZip } from "@/lib/search";
import { getSubServices } from "@/lib/data/service-directory";
import { serviceCategories } from "@/lib/data/services";
import { formatLocation, formatStartingPrice } from "@/lib/format";
import type { Provider, ServiceCategory } from "@/lib/types";

export type ExplorerMatch = {
  job: string;
  zip?: string;
  low: number;
  high: number;
  sent?: { number: string; count: number } | null;
  onEdit: () => void;
};

const ProviderMap = dynamic(
  () => import("@/components/marketplace/provider-map").then((mod) => mod.ProviderMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  }
);

type SortKey = "rating" | "reviews" | "years";

function majorityLocation(providers: Provider[]) {
  const counts = new Map<string, { label: string; count: number }>();
  for (const provider of providers) {
    const key = `${provider.city}|${provider.state}`;
    const current = counts.get(key);
    counts.set(key, {
      label: `${provider.city} ${provider.state}`,
      count: (current?.count ?? 0) + 1,
    });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)[0]?.label ?? "";
}

export function CategoryExplorer({
  category,
  providers,
  initialAddress = "",
  initialJob = "",
  marketplace = false,
  match,
}: {
  category?: ServiceCategory;
  providers: Provider[];
  initialAddress?: string;
  initialJob?: string;
  marketplace?: boolean;
  match?: ExplorerMatch;
}) {
  const router = useRouter();
  const startingAddress = initialAddress || majorityLocation(providers);
  const [address, setAddress] = useState(startingAddress);
  const [serviceSlug, setServiceSlug] = useState(category?.slug ?? "all");
  const [subService, setSubService] = useState(initialJob);
  const [minRating, setMinRating] = useState(0);
  const [licensedOnly, setLicensedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("rating");
  const [selectedId, setSelectedId] = useState<string | null>(providers[0]?.id ?? null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [fitToken, setFitToken] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const activeCategory =
    serviceSlug === "all"
      ? undefined
      : serviceCategories.find((item) => item.slug === serviceSlug);
  const subServices = activeCategory ? getSubServices(activeCategory.slug) : undefined;
  const selectedSub =
    subServices?.options.find((option) => option.value === subService || option.job === subService);
  const scopedProviders = useMemo(() => {
    if (!activeCategory || !marketplace) return providers;
    return providers.filter((provider) => provider.categoryIds.includes(activeCategory.id));
  }, [activeCategory, marketplace, providers]);

  const results = useMemo(() => {
    const query = address.trim().toLowerCase();
    const place = parsePlaceInput(address);
    const market = findMarketCity(place.city, place.state);
    const state = (place.state || market?.state || "").toUpperCase();

    const matchesFilters = (provider: Provider) =>
      provider.rating >= minRating && (licensedOnly ? provider.licensed : true);

    const matchesAddress = (provider: Provider) =>
      !query ||
      provider.city.toLowerCase().includes(query) ||
      provider.state.toLowerCase().includes(query) ||
      `${provider.city} ${provider.state}`.toLowerCase().includes(query) ||
      provider.zip.includes(query) ||
      formatLocation(provider.city, provider.state, provider.zip)
        .toLowerCase()
        .includes(query) ||
      provider.serviceArea.some((zip) => zip.includes(query));

    const exact = scopedProviders.filter((provider) => matchesAddress(provider) && matchesFilters(provider));
    const next =
      exact.length || !state
        ? exact
        : scopedProviders.filter((provider) => provider.state === state && matchesFilters(provider));

    next.sort((a, b) => {
      if (sort === "reviews") return b.reviewCount - a.reviewCount;
      if (sort === "years") return b.yearsInBusiness - a.yearsInBusiness;
      return b.rating - a.rating;
    });
    return next;
  }, [address, licensedOnly, minRating, scopedProviders, sort]);

  useEffect(() => {
    setServiceSlug(category?.slug ?? "all");
    setSubService(initialJob);
  }, [category?.slug, initialJob]);

  useEffect(() => {
    if (!subService) return;
    const options = getSubServices(activeCategory?.slug)?.options ?? [];
    if (!options.some((option) => option.value === subService || option.job === subService)) {
      setSubService("");
    }
  }, [activeCategory?.slug, subService]);

  useEffect(() => {
    if (!results.some((provider) => provider.id === selectedId)) {
      setSelectedId(results[0]?.id ?? null);
    }
  }, [results, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const node = listRef.current?.querySelector(`[data-provider="${selectedId}"]`);
    node?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  function recenter(event?: FormEvent) {
    event?.preventDefault();
    setFitToken((value) => value + 1);
    if (marketplace) syncMarketplaceUrl(serviceSlug, subService);
  }

  function syncMarketplaceUrl(slug: string, job = "") {
    const params = new URLSearchParams();
    if (slug !== "all") params.set("service", slug);
    if (slug !== "all" && job) params.set("job", job);
    const trimmed = address.trim();
    const zip = extractZip(trimmed);
    if (zip) params.set("zip", zip);
    if (trimmed && trimmed !== zip) params.set("loc", trimmed);
    const query = params.toString();
    router.replace(query ? `/find-a-professional?${query}` : "/find-a-professional");
  }

  function onServiceChange(slug: string) {
    if (!marketplace) {
      router.push(`/services/${slug}`);
      return;
    }

    setServiceSlug(slug);
    setSubService("");
    setFitToken((value) => value + 1);
    syncMarketplaceUrl(slug);
  }

  function onSubServiceChange(value: string) {
    setSubService(value);
    setFitToken((value) => value + 1);
    if (marketplace) syncMarketplaceUrl(serviceSlug, value);
  }

  const searchedPlace = parsePlaceInput(address);
  const searchedMarket = findMarketCity(searchedPlace.city, searchedPlace.state);
  const cityLabel = searchedMarket
    ? `${searchedMarket.city}, ${searchedMarket.state}`
    : searchedPlace.city
      ? searchedPlace.state
        ? `${searchedPlace.city}, ${searchedPlace.state}`
        : searchedPlace.city
      : searchedPlace.state
        ? stateLabel(searchedPlace.state)
        : results[0]
          ? `${results[0].city}, ${results[0].state}`
          : address.trim() || activeCategory?.name || "your area";
  const heading = selectedSub
    ? `${selectedSub.label} in ${cityLabel}`
    : activeCategory
      ? `${activeCategory.name} in ${cityLabel}`
      : `Professionals in ${cityLabel}`;

  return (
    <div className="container-site flex h-[calc(100dvh-4.25rem)] flex-col overflow-hidden bg-background">
      <div className="z-20 shrink-0 border-b bg-background">
        <form
          onSubmit={recenter}
          className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center lg:gap-3"
        >
          <div className="relative min-w-0 w-full max-w-56">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              onBlur={() => {
                if (marketplace) syncMarketplaceUrl(serviceSlug, subService);
              }}
              placeholder="City, state, or ZIP"
              className="h-10 rounded-lg bg-card pr-9 pl-9"
              aria-label="Address"
            />
            {address ? (
              <button
                type="button"
                onClick={() => setAddress("")}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear address"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-1 sm:flex-wrap sm:items-center">
            <NativeSelect
              value={marketplace ? serviceSlug : (category?.slug ?? "all")}
              onChange={(event) => onServiceChange(event.target.value)}
              className="w-full min-w-0 sm:w-fit [&>select]:h-10 [&>select]:w-full [&>select]:border-primary [&>select]:bg-card [&>select]:text-primary sm:[&>select]:min-w-36"
              aria-label="Service"
            >
              {marketplace ? (
                <NativeSelectOption value="all">All services</NativeSelectOption>
              ) : null}
              {serviceCategories.map((item) => (
                <NativeSelectOption key={item.id} value={item.slug}>
                  {item.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>

            {subServices ? (
              <NativeSelect
                value={subService}
                onChange={(event) => onSubServiceChange(event.target.value)}
                className="w-full min-w-0 sm:w-fit [&>select]:h-10 [&>select]:w-full [&>select]:bg-card sm:[&>select]:min-w-44 sm:[&>select]:max-w-64"
                aria-label="Sub-service"
              >
                <NativeSelectOption value="">All {activeCategory?.shortName} jobs</NativeSelectOption>
                {subServices.options.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : null}

            <NativeSelect
              value={String(minRating)}
              onChange={(event) => {
                setMinRating(Number(event.target.value));
                setFitToken((value) => value + 1);
              }}
              className="w-full min-w-0 sm:w-fit [&>select]:h-10 [&>select]:w-full [&>select]:bg-card sm:[&>select]:min-w-28"
              aria-label="Rating"
            >
              <NativeSelectOption value="0">Rating</NativeSelectOption>
              <NativeSelectOption value="4.5">4.5+</NativeSelectOption>
              <NativeSelectOption value="4.8">4.8+</NativeSelectOption>
            </NativeSelect>

            <NativeSelect
              value={licensedOnly ? "licensed" : "any"}
              onChange={(event) => {
                setLicensedOnly(event.target.value === "licensed");
                setFitToken((value) => value + 1);
              }}
              className="col-span-2 w-full min-w-0 sm:col-span-1 sm:w-fit [&>select]:h-10 [&>select]:w-full [&>select]:bg-card sm:[&>select]:min-w-32"
              aria-label="License"
            >
              <NativeSelectOption value="any">All pros</NativeSelectOption>
              <NativeSelectOption value="licensed">Licensed</NativeSelectOption>
            </NativeSelect>
          </div>
        </form>
        {match ? (
          <div className="flex flex-col gap-3 border-t bg-secondary/80 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                Matched from your answers
              </p>
              <p className="truncate text-base font-semibold">{match.job}</p>
              <p className="text-sm text-muted-foreground">
                {match.zip ? `ZIP ${match.zip}` : "Your area"}
                {match.sent
                  ? ` · ${match.sent.number} sent to ${match.sent.count} ${match.sent.count === 1 ? "company" : "companies"}`
                  : " · written estimate after a visit"}
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 sm:justify-end">
              <p className="text-right">
                <span className="block text-[11px] text-muted-foreground">Typical start</span>
                <span className="block text-xl font-semibold tracking-tight text-brand tabular-nums">
                  {formatStartingPrice(match.low)}–{formatStartingPrice(match.high)}
                </span>
              </p>
              <Button type="button" variant="outline" size="sm" onClick={match.onEdit}>
                Edit answers
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div
          data-lenis-prevent
          className="relative h-[32vh] min-h-52 shrink-0 overflow-hidden border-b sm:h-[36vh] lg:h-auto lg:min-h-0 lg:w-[60%] lg:flex-none lg:border-r lg:border-b-0"
        >
          <ProviderMap
            providers={results}
            selectedId={selectedId}
            hoveredId={hoveredId}
            fitToken={fitToken}
            onSelect={setSelectedId}
            onHover={setHoveredId}
          />
          <div className="pointer-events-none absolute top-3 left-3 z-[1100]">
            <span className="rounded-md bg-black/70 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md">
              {results.length} of {scopedProviders.length} professionals
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            className="absolute top-3 right-3 z-[1100]"
            onClick={() => setFitToken((value) => value + 1)}
          >
            Re-center
          </Button>
        </div>

        <aside className="flex min-h-0 w-full flex-1 flex-col bg-background lg:w-[40%] lg:flex-none">
          <div className="flex shrink-0 flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-end sm:justify-between sm:px-5 sm:py-3.5">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">{heading}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {results.length} {results.length === 1 ? "result" : "results"}
              </p>
            </div>
            <NativeSelect
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="w-full min-w-0 shrink-0 sm:w-auto [&>select]:w-full [&>select]:bg-card sm:[&>select]:w-auto"
              aria-label="Sort"
            >
              <NativeSelectOption value="rating">Sort: Highest rated</NativeSelectOption>
              <NativeSelectOption value="reviews">Sort: Most reviews</NativeSelectOption>
              <NativeSelectOption value="years">Sort: Most experienced</NativeSelectOption>
            </NativeSelect>
          </div>

          {results.length ? (
            <ul
              key={`${serviceSlug}-${subService}-${sort}-${minRating}-${licensedOnly}-${address}`}
              ref={listRef}
              data-lenis-prevent
              className="reveal-list grid min-h-0 flex-1 content-start grid-cols-1 gap-4 overflow-y-auto overscroll-contain p-3 sm:p-4 md:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2"
            >
              {results.map((provider) => {
                const active = provider.id === selectedId || provider.id === hoveredId;

                return (
                  <li key={provider.id} data-provider={provider.id}>
                    <ProviderCard
                      provider={provider}
                      visual
                      active={active}
                      place={parsePlaceInput(address)}
                      onClick={() => setSelectedId(provider.id)}
                      onMouseEnter={() => setHoveredId(provider.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="font-medium">No professionals match that search</p>
              <p className="text-sm text-muted-foreground">
                Clear the address or change a filter to see more results.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAddress("");
                  setSubService("");
                  setMinRating(0);
                  setLicensedOnly(false);
                  if (marketplace) syncMarketplaceUrl(serviceSlug);
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
