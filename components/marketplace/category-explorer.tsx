"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { CenteredSpinner, Spinner } from "@/components/ui/spinner";
import { ProviderCard } from "@/components/shared/provider-card";
import {
  AddressAutocomplete,
  type PlaceAddress,
} from "@/components/shared/address-autocomplete";
import {
  PaginatedCategorySelect,
  type CategoryOption,
} from "@/components/portal/paginated-category-select";
import { findMarketCity, stateLabel } from "@/lib/data/markets";
import { parsePlaceInput } from "@/lib/data/profile-explore";
import { extractZip } from "@/lib/search";
import { getSubServices } from "@/lib/data/service-directory";
import { serviceCategories } from "@/lib/data/services";
import { formatLocation, formatStartingPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Provider, ServiceCategory } from "@/lib/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchParentCategories,
  selectParentCategories,
} from "@/store/categoriesSlice";
import {
  clearLocation,
  detectCurrentLocation,
  hasLocation,
  hydrateLocationIfEmpty,
  isCommittedLocation,
  locationDisplayLabel,
  setLocationFromPlace,
} from "@/store/locationSlice";
import {
  buildPublicProfessionalsQueryKey,
  fetchPublicProfessionals,
  publicProfessionalToProvider,
  resetPublicProfessionals,
  type PublicProfessionalSortBy,
  type PublicProfessionalsQuery,
} from "@/store/publicProfessionalsSlice";

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

function sortByFromUi(sort: SortKey): PublicProfessionalSortBy {
  if (sort === "reviews") return "completed_jobs";
  if (sort === "years") return "experience";
  return "rating";
}

export function CategoryExplorer({
  category,
  providers,
  initialAddress = "",
  initialJob = "",
  marketplace = false,
  /** Live GET /api/public/professionals — Find a Professional only. */
  liveProfessionals = false,
  match,
}: {
  category?: ServiceCategory;
  providers: Provider[];
  initialAddress?: string;
  initialJob?: string;
  marketplace?: boolean;
  liveProfessionals?: boolean;
  match?: ExplorerMatch;
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const customerLocation = useAppSelector((state) => state.location);
  const parentCategories = useAppSelector(selectParentCategories);
  const parentsLoaded = useAppSelector((state) => state.categories.parentsLoaded);
  const loadingParents = useAppSelector((state) => state.categories.loadingParents);
  const parentsHasMore = useAppSelector((state) => state.categories.parentsHasMore);
  const loadingMoreParents = useAppSelector(
    (state) => state.categories.loadingMoreParents,
  );

  const liveItems = useAppSelector((state) => state.publicProfessionals.items);
  const liveTotal = useAppSelector((state) => state.publicProfessionals.total);
  const liveLoading = useAppSelector((state) => state.publicProfessionals.loading);
  const liveLoadingMore = useAppSelector(
    (state) => state.publicProfessionals.loadingMore,
  );
  const liveHasNextPage = useAppSelector(
    (state) => state.publicProfessionals.hasNextPage,
  );
  const liveLoaded = useAppSelector((state) => state.publicProfessionals.loaded);
  const liveError = useAppSelector((state) => state.publicProfessionals.error);

  const locationLabel = locationDisplayLabel(customerLocation);
  const locationValue =
    customerLocation.address ||
    customerLocation.city ||
    customerLocation.zip ||
    "";
  // Local draft while typing — do not write keystrokes into Redux (avoids API refetches).
  const [locationDraft, setLocationDraft] = useState<string | null>(null);
  const locationInputValue = locationDraft ?? locationValue;
  const startingAddress =
    initialAddress ||
    (liveProfessionals ? locationLabel : "") ||
    majorityLocation(providers);
  const [address, setAddress] = useState(startingAddress);
  const [serviceSlug, setServiceSlug] = useState(category?.slug ?? "all");
  const [categoryId, setCategoryId] = useState("");
  const [subService, setSubService] = useState(initialJob);
  const [minRating, setMinRating] = useState(0);
  const [licensedOnly, setLicensedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("rating");
  const [selectedId, setSelectedId] = useState<string | null>(
    providers[0]?.id ?? null,
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [fitToken, setFitToken] = useState(0);
  const [pendingRefresh, setPendingRefresh] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const prevLiveQueryKeyRef = useRef("");

  const useLive = Boolean(marketplace && liveProfessionals);

  const activeCategory =
    serviceSlug === "all"
      ? undefined
      : serviceCategories.find((item) => item.slug === serviceSlug);
  const selectedParent = useMemo(
    () =>
      parentCategories.find(
        (item) => item.id === categoryId || item.slug === serviceSlug,
      ),
    [categoryId, parentCategories, serviceSlug],
  );
  const subServices = !useLive && activeCategory
    ? getSubServices(activeCategory.slug)
    : undefined;
  const selectedSub =
    subServices?.options.find((option) => option.value === subService || option.job === subService);

  const liveProviders = useMemo(
    () => liveItems.map(publicProfessionalToProvider),
    [liveItems],
  );

  const scopedProviders = useMemo(() => {
    if (useLive) return liveProviders;
    if (!activeCategory || !marketplace) return providers;
    return providers.filter((provider) => provider.categoryIds.includes(activeCategory.id));
  }, [activeCategory, liveProviders, marketplace, providers, useLive]);

  const results = useMemo(() => {
    if (useLive) return scopedProviders;

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
  }, [address, licensedOnly, minRating, scopedProviders, sort, useLive]);

  const liveQuery = useMemo((): PublicProfessionalsQuery => {
    const committed = isCommittedLocation(customerLocation);
    const next: PublicProfessionalsQuery = {
      sortBy: sortByFromUi(sort),
      sortOrder: "desc",
      locationToken: committed
        ? [
            customerLocation.zip,
            customerLocation.city,
            customerLocation.state,
            customerLocation.country,
            customerLocation.latitude ?? "",
            customerLocation.longitude ?? "",
          ].join("|")
        : "",
    };
    if (minRating > 0) next.minRating = minRating;
    if (licensedOnly) next.isIdentityVerified = true;
    if (categoryId) next.category = categoryId;

    // Send only committed location fields (selected place / geo), not mid-typing address.
    if (customerLocation.zip.trim()) {
      next.zipCode = customerLocation.zip.trim();
    }
    if (
      customerLocation.latitude != null &&
      Number.isFinite(customerLocation.latitude)
    ) {
      next.lat = customerLocation.latitude;
    }
    if (
      customerLocation.longitude != null &&
      Number.isFinite(customerLocation.longitude)
    ) {
      next.lng = customerLocation.longitude;
    }

    return next;
  }, [
    categoryId,
    customerLocation.city,
    customerLocation.country,
    customerLocation.latitude,
    customerLocation.longitude,
    customerLocation.state,
    customerLocation.zip,
    licensedOnly,
    minRating,
    sort,
  ]);

  const liveQueryKey = buildPublicProfessionalsQueryKey(liveQuery);
  const liveQueryRef = useRef(liveQuery);
  liveQueryRef.current = liveQuery;
  const resultsCountRef = useRef(0);
  resultsCountRef.current = results.length;

  const locationReady =
    customerLocation.detectAttempted && !customerLocation.detecting;
  const locationCommitted = isCommittedLocation(customerLocation);
  const showRefreshOverlay =
    useLive &&
    results.length > 0 &&
    (liveLoading || pendingRefresh);
  const showInitialSpinner =
    useLive &&
    !results.length &&
    (!locationReady ||
      (locationCommitted &&
        (liveLoading ||
          pendingRefresh ||
          (!liveLoaded && !liveError))));

  useEffect(() => {
    if (!useLive) return;
    if (initialAddress || customerLocation.zip) {
      dispatch(
        hydrateLocationIfEmpty({
          address: initialAddress,
          city: initialAddress,
          zip: extractZip(initialAddress) || undefined,
        }),
      );
    }
  }, [customerLocation.zip, dispatch, initialAddress, useLive]);

  useEffect(() => {
    if (!useLive) return;
    if (customerLocation.detectAttempted || customerLocation.detecting) return;
    if (hasLocation(customerLocation)) return;
    void dispatch(detectCurrentLocation());
  }, [
    customerLocation.address,
    customerLocation.city,
    customerLocation.detectAttempted,
    customerLocation.detecting,
    customerLocation.latitude,
    customerLocation.longitude,
    customerLocation.zip,
    dispatch,
    useLive,
  ]);

  useEffect(() => {
    if (!useLive) return;
    void dispatch(fetchParentCategories());
  }, [dispatch, useLive]);

  useEffect(() => {
    if (!useLive) return;
    if (!parentsLoaded || !parentsHasMore || loadingParents || loadingMoreParents) {
      return;
    }
    void dispatch(fetchParentCategories({ append: true }));
  }, [
    dispatch,
    loadingMoreParents,
    loadingParents,
    parentsHasMore,
    parentsLoaded,
    useLive,
  ]);

  // Sync initial static category slug → API category id once parents load.
  useEffect(() => {
    if (!useLive || categoryId) return;
    if (!category?.slug && serviceSlug === "all") return;
    const slug = category?.slug || (serviceSlug !== "all" ? serviceSlug : "");
    if (!slug) return;
    const matchParent = parentCategories.find((item) => item.slug === slug);
    if (matchParent) {
      setCategoryId(matchParent.id);
      setServiceSlug(matchParent.slug);
    }
  }, [category?.slug, categoryId, parentCategories, serviceSlug, useLive]);

  // Wait for location bootstrap, then fetch only with a committed location (never while typing).
  useEffect(() => {
    if (!useLive) return;
    if (!locationReady || !locationCommitted) {
      setPendingRefresh(false);
      prevLiveQueryKeyRef.current = liveQueryKey;
      return;
    }

    const queryChanged = prevLiveQueryKeyRef.current !== liveQueryKey;
    if (queryChanged && resultsCountRef.current > 0) {
      setPendingRefresh(true);
    }
    prevLiveQueryKeyRef.current = liveQueryKey;

    const timer = window.setTimeout(() => {
      void dispatch(
        fetchPublicProfessionals({ query: liveQueryRef.current }),
      );
    }, 220);
    return () => window.clearTimeout(timer);
  }, [dispatch, liveQueryKey, locationCommitted, locationReady, useLive]);

  // Clear stale results when location is cleared (same idea as Fixed Services gate).
  useEffect(() => {
    if (!useLive) return;
    if (locationReady && !locationCommitted) {
      dispatch(resetPublicProfessionals());
    }
  }, [dispatch, locationCommitted, locationReady, useLive]);

  useEffect(() => {
    if (!liveLoading) setPendingRefresh(false);
  }, [liveLoading]);

  useEffect(() => {
    setServiceSlug(category?.slug ?? "all");
    setSubService(initialJob);
    if (!category) {
      setCategoryId("");
    }
  }, [category?.slug, initialJob]);

  useEffect(() => {
    if (useLive) return;
    if (!subService) return;
    const options = getSubServices(activeCategory?.slug)?.options ?? [];
    if (!options.some((option) => option.value === subService || option.job === subService)) {
      setSubService("");
    }
  }, [activeCategory?.slug, subService, useLive]);

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
    if (useLive) {
      const zip = customerLocation.zip.trim();
      const loc = locationLabel.trim();
      if (zip) params.set("zip", zip);
      if (loc && loc !== zip) params.set("loc", loc);
    } else {
      const trimmed = address.trim();
      const zip = extractZip(trimmed);
      if (zip) params.set("zip", zip);
      if (trimmed && trimmed !== zip) params.set("loc", trimmed);
    }
    const query = params.toString();
    router.replace(query ? `/find-a-professional?${query}` : "/find-a-professional");
  }

  function applyLivePlace(place: PlaceAddress) {
    setLocationDraft(null);
    dispatch(setLocationFromPlace(place));
    setFitToken((value) => value + 1);
    if (marketplace) {
      // URL sync after Redux updates on next paint — use place fields directly.
      const params = new URLSearchParams();
      if (serviceSlug !== "all") params.set("service", serviceSlug);
      const zip = place.zipCode?.trim() || "";
      const loc =
        place.formattedAddress?.trim() ||
        [place.city, place.state].filter(Boolean).join(", ") ||
        zip;
      if (zip) params.set("zip", zip);
      if (loc && loc !== zip) params.set("loc", loc);
      const query = params.toString();
      router.replace(query ? `/find-a-professional?${query}` : "/find-a-professional");
    }
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

  function onLiveCategoryChange(id: string, _option?: CategoryOption) {
    if (!id) {
      setCategoryId("");
      setServiceSlug("all");
      setSubService("");
      setFitToken((value) => value + 1);
      syncMarketplaceUrl("all");
      return;
    }
    const parent = parentCategories.find((item) => item.id === id);
    setCategoryId(id);
    setServiceSlug(parent?.slug || id);
    setSubService("");
    setFitToken((value) => value + 1);
    syncMarketplaceUrl(parent?.slug || "all");
  }

  function onSubServiceChange(value: string) {
    setSubService(value);
    setFitToken((value) => value + 1);
    if (marketplace) syncMarketplaceUrl(serviceSlug, value);
  }

  const searchedPlace = parsePlaceInput(
    useLive ? locationInputValue || locationLabel : address,
  );
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
          ? `${results[0].city}${results[0].state ? `, ${results[0].state}` : ""}`
          : address.trim() ||
            (useLive && isCommittedLocation(customerLocation)
              ? locationLabel
              : "") ||
            selectedParent?.name ||
            activeCategory?.name ||
            "your area";
  const heading = useLive
    ? selectedParent
      ? `${selectedParent.name} in ${cityLabel}`
      : `Professionals in ${cityLabel}`
    : selectedSub
      ? `${selectedSub.label} in ${cityLabel}`
      : activeCategory
        ? `${activeCategory.name} in ${cityLabel}`
        : `Professionals in ${cityLabel}`;

  const mapCountTotal = useLive ? liveTotal : scopedProviders.length;
  const parentOptions: CategoryOption[] = parentCategories.map((item) => ({
    id: item.id,
    name: item.name,
  }));

  return (
    <div className="container-site flex flex-col bg-background lg:h-[calc(100dvh-4.25rem)]">
      <div className="relative z-[1200] shrink-0 overflow-visible border-b bg-background">
        <form
          onSubmit={recenter}
          className="relative z-[1200] flex flex-col gap-2 overflow-visible py-3 lg:flex-row lg:items-center lg:gap-3"
        >
          <div className="relative z-[1300] min-w-0 w-full max-w-56">
            {useLive ? (
              <AddressAutocomplete
                value={locationInputValue}
                onChange={(value) => {
                  if (!value.trim()) {
                    setLocationDraft(null);
                    dispatch(clearLocation());
                    return;
                  }
                  setLocationDraft(value);
                }}
                onSelect={applyLivePlace}
                placeholder="City, state, or ZIP"
                autoComplete="off"
                hideStatus
                inputClassName="h-10 rounded-lg bg-card"
              />
            ) : (
              <>
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
              </>
            )}
          </div>

          <div className="relative z-[1200] grid min-w-0 grid-cols-2 gap-2 overflow-visible sm:flex sm:flex-1 sm:flex-wrap sm:items-center">
            {useLive ? (
              <PaginatedCategorySelect
                value={categoryId}
                options={parentOptions}
                placeholder="All services"
                loading={loadingParents && !parentOptions.length}
                loadingMore={loadingMoreParents}
                hasMore={parentsHasMore}
                onChange={onLiveCategoryChange}
                onLoadMore={() => {
                  if (!parentsHasMore || loadingMoreParents) return;
                  void dispatch(fetchParentCategories({ append: true }));
                }}
                className="w-full min-w-0 sm:w-fit sm:min-w-36 [&_button]:border-primary [&_button]:bg-card [&_button]:text-primary"
              />
            ) : (
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
            )}

            {!useLive && subServices ? (
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
              value={minRating > 0 ? String(minRating) : ""}
              onChange={(event) => {
                const next = Number(event.target.value);
                setMinRating(Number.isFinite(next) && next > 0 ? next : 0);
                setFitToken((value) => value + 1);
              }}
              className="relative z-[1300] w-full min-w-0 sm:w-fit [&>select]:h-10 [&>select]:w-full [&>select]:bg-card sm:[&>select]:min-w-28"
              aria-label="Rating"
            >
              <NativeSelectOption value="">Rating</NativeSelectOption>
              <NativeSelectOption value="1">1+</NativeSelectOption>
              <NativeSelectOption value="2">2+</NativeSelectOption>
              <NativeSelectOption value="3">3+</NativeSelectOption>
              <NativeSelectOption value="4">4+</NativeSelectOption>
              <NativeSelectOption value="5">5</NativeSelectOption>
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

      <div className="relative z-0 flex flex-col lg:min-h-0 lg:flex-1 lg:flex-row lg:overflow-hidden">
        {showRefreshOverlay ? (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-background/40"
            aria-busy="true"
            aria-live="polite"
          >
            <Spinner size="lg" label="Loading professionals" />
          </div>
        ) : null}

        <div
          data-lenis-prevent
          className={cn(
            "relative h-[32vh] min-h-52 shrink-0 overflow-hidden border-b sm:h-[36vh] lg:h-auto lg:min-h-[24rem] lg:w-[48%] lg:flex-none lg:border-r lg:border-b-0",
            showRefreshOverlay && "pointer-events-none opacity-55",
          )}
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
              {results.length} of {mapCountTotal} professionals
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

        <aside
          className={cn(
            "flex w-full flex-col bg-background lg:min-h-0 lg:w-[52%] lg:flex-none",
            showRefreshOverlay && "pointer-events-none opacity-55",
          )}
        >
          <div className="flex shrink-0 flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-end sm:justify-between sm:px-5 sm:py-3.5">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">{heading}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {useLive
                  ? `${liveTotal} ${liveTotal === 1 ? "result" : "results"}`
                  : `${results.length} ${results.length === 1 ? "result" : "results"}`}
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

          {showInitialSpinner ? (
            <CenteredSpinner label="Loading professionals" className="min-h-64" />
          ) : results.length ? (
            <>
              <ul
                ref={listRef}
                data-lenis-prevent
                className={cn(
                  "grid content-start grid-cols-1 gap-4 p-3 sm:p-4",
                  "lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain",
                  !useLive && "md:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2",
                  useLive && "xl:grid-cols-2",
                  !showRefreshOverlay && "reveal-list",
                )}
              >
                {results.map((provider) => {
                  const active = provider.id === selectedId || provider.id === hoveredId;

                  return (
                    <li key={provider.id} data-provider={provider.id}>
                      <ProviderCard
                        provider={provider}
                        visual
                        active={active}
                        place={parsePlaceInput(
                          useLive
                            ? locationInputValue || locationLabel
                            : address,
                        )}
                        onClick={() => setSelectedId(provider.id)}
                        onMouseEnter={() => setHoveredId(provider.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      />
                    </li>
                  );
                })}
              </ul>
              {useLive && liveHasNextPage ? (
                <div className="shrink-0 border-t px-4 py-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={liveLoadingMore || liveLoading}
                    onClick={() =>
                      void dispatch(fetchPublicProfessionals({ append: true }))
                    }
                  >
                    {liveLoadingMore ? "Loading…" : "See more"}
                  </Button>
                </div>
              ) : null}
            </>
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
