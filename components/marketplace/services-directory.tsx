"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  ListFilter,
  Rows3,
  Star,
  Tag,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/layout/container";
import { ServiceJobCard } from "@/components/marketplace/service-job-card";
import { ServicesHero } from "@/components/marketplace/services-hero";
import { ServicesQualifyDialog } from "@/components/marketplace/services-qualify-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { ProviderCard } from "@/components/shared/provider-card";
import { writePendingQuote } from "@/lib/booking/format-quote-answers";
import { parsePlaceInput } from "@/lib/data/profile-explore";
import { getAllJobs, getJobRecord } from "@/lib/data/jobs";
import { getStartingPrice } from "@/lib/data/provider-media";
import { getAllProviders, getProvidersByCategoryId } from "@/lib/data/providers";
import {
  findSubServiceValue,
  getCommonFilters,
  getServiceFilters,
  getSubServiceOption,
  type DirectoryFilter,
} from "@/lib/data/service-directory";
import { serviceCategories } from "@/lib/data/services";
import { formatStartingPrice } from "@/lib/format";
import {
  extractZip,
  resolveSearchIntent,
  servicesHref,
  type SearchIntent,
} from "@/lib/search";
import { cn } from "@/lib/utils";
import type { Provider } from "@/lib/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearLocation,
  hydrateLocationIfEmpty,
  locationDisplayLabel,
} from "@/store/locationSlice";

type SortKey = "price-asc" | "price-desc" | "rating";
type ViewKey = "grid" | "list";

const PAGE_SIZE = 10;

function DirectoryPagination({
  page,
  pageCount,
  onPage,
  label,
}: {
  page: number;
  pageCount: number;
  onPage: (next: number) => void;
  label: string;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-center gap-2 pt-1">
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous page"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft />
      </Button>
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
        <Button
          key={number}
          variant={number === page ? "default" : "outline"}
          size="icon"
          aria-label={`Page ${number}`}
          aria-current={number === page ? "page" : undefined}
          onClick={() => onPage(number)}
        >
          {number}
        </Button>
      ))}
      <Button
        variant="outline"
        size="icon"
        aria-label="Next page"
        disabled={page === pageCount}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight />
      </Button>
    </nav>
  );
}

const viewOptions: { value: ViewKey; label: string; icon: LucideIcon }[] = [
  { value: "grid", label: "Grid view", icon: LayoutGrid },
  { value: "list", label: "List view", icon: Rows3 },
];

function uniqueProviders(providers: Provider[]) {
  return [...new Map(providers.map((provider) => [provider.id, provider])).values()];
}

function answersFromIntent(intent: SearchIntent) {
  const next: Record<string, string> = {};
  if (!intent.service || !intent.job) return next;
  const sub = findSubServiceValue(intent.service, intent.query, intent.job);
  if (sub) next["sub-service"] = sub;
  return next;
}

function professionalsFor(categoryIds: string[], zip?: string) {
  const pool = categoryIds.length
    ? categoryIds.flatMap((id) => getProvidersByCategoryId(id))
    : getAllProviders();
  const unique = uniqueProviders(pool);
  if (!zip) return unique;
  const local = unique.filter((provider) => provider.zip === zip || provider.serviceArea.includes(zip));
  return local.length ? local : unique;
}

const allProfessionals = uniqueProviders(getAllProviders());

const priceBounds = allProfessionals.reduce(
  (range, provider) => {
    const price = getStartingPrice(provider);
    return { min: Math.min(range.min, price), max: Math.max(range.max, price) };
  },
  { min: getStartingPrice(allProfessionals[0]), max: getStartingPrice(allProfessionals[0]) },
);

const ratingFilters = [5, 4, 3, 2]
  .map((rating) => ({
    rating,
    count: allProfessionals.filter((provider) => provider.rating >= rating).length,
  }))
  .filter((option) => option.count > 0);

function FilterBlock({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border-b py-3.5 last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 text-left text-sm font-semibold"
      >
        <span className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          {title}
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {open ? <div className="flex flex-col gap-1 pt-3">{children}</div> : null}
    </div>
  );
}

function RadioFilter({
  filter,
  value,
  onChange,
}: {
  filter: DirectoryFilter;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="gap-1">
      {filter.options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-start gap-2.5 rounded-md px-1.5 py-1.5 text-sm transition-colors hover:bg-muted"
        >
          <RadioGroupItem value={option.value} className="mt-0.5" />
          <span>
            <span className="block">{option.label}</span>
            {option.hint ? (
              <span className="text-xs text-muted-foreground">{option.hint}</span>
            ) : null}
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}

export function ServicesDirectory({
  initialQuery = "",
  initialCategory = "",
  initialJob = "",
  initialZip = "",
  initialLocation = "",
}: {
  initialQuery?: string;
  initialCategory?: string;
  initialJob?: string;
  initialZip?: string;
  initialLocation?: string;
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const customerLocation = useAppSelector((state) => state.location);
  const location = locationDisplayLabel(customerLocation);
  const zip = customerLocation.zip;
  const seed = resolveSearchIntent({
    query: initialQuery,
    service: initialCategory,
    job: initialJob,
    zip: initialZip,
    location: initialLocation || initialZip,
  });
  const [query, setQuery] = useState(seed.query);
  const [categories, setCategories] = useState<string[]>(seed.service ? [seed.service] : []);
  const [minPrice, setMinPrice] = useState(priceBounds.min);
  const [maxPrice, setMaxPrice] = useState(priceBounds.max);
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState<SortKey>("price-asc");
  const [page, setPage] = useState(1);
  const [servicePage, setServicePage] = useState(1);
  const [view, setView] = useState<ViewKey>("list");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>(() => answersFromIntent(seed));
  const resultsRef = useRef<HTMLDivElement>(null);
  const professionalsRef = useRef<HTMLDivElement>(null);
  const skipUrlRef = useRef(true);

  const activeCategory = categories.length === 1 ? categories[0] : "";
  const commonFilters = getCommonFilters();
  const serviceFilters = getServiceFilters(activeCategory);
  const subOption = getSubServiceOption(activeCategory, answers["sub-service"]);
  const featuredJob =
    activeCategory && (subOption?.job || subOption?.value)
      ? getJobRecord(activeCategory, subOption.job ?? subOption.value ?? "")
      : undefined;
  const directoryJobs = useMemo(() => {
    if (featuredJob) return [];
    const all = getAllJobs();
    if (!categories.length) return all;
    return all.filter((item) => categories.includes(item.category.slug));
  }, [categories, featuredJob]);

  const servicePageCount = Math.max(1, Math.ceil(directoryJobs.length / PAGE_SIZE));
  const currentServicePage = Math.min(servicePage, servicePageCount);
  const pageJobs = directoryJobs.slice(
    (currentServicePage - 1) * PAGE_SIZE,
    currentServicePage * PAGE_SIZE,
  );

  const results = useMemo(() => {
    const selectedIds = categories
      .map((slug) => serviceCategories.find((item) => item.slug === slug)?.id)
      .filter((id): id is string => Boolean(id));
    const pageCategoryIds = [...new Set(pageJobs.map((item) => item.category.id))];
    const categoryIds = featuredJob
      ? [featuredJob.category.id]
      : selectedIds.length
        ? selectedIds
        : pageCategoryIds;
    const nextZip = zip || extractZip(location);

    return professionalsFor(categoryIds, nextZip)
      .filter((provider) => {
        const price = getStartingPrice(provider);
        if (price < minPrice || price > maxPrice) return false;
        if (provider.rating < minRating) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === "price-desc") return getStartingPrice(b) - getStartingPrice(a);
        if (sort === "rating") return b.rating - a.rating;
        return getStartingPrice(a) - getStartingPrice(b);
      });
  }, [categories, featuredJob, location, minPrice, maxPrice, minRating, pageJobs, sort, zip]);

  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = results.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const selectedCategory = serviceCategories.find((item) => item.slug === activeCategory);

  useEffect(() => {
    const next = resolveSearchIntent({
      query: initialQuery,
      service: initialCategory,
      job: initialJob,
      zip: initialZip,
      location: initialLocation || initialZip,
    });
    skipUrlRef.current = true;
    setQuery(next.query);
    setCategories(next.service ? [next.service] : []);
    if (next.location || next.zip) {
      dispatch(
        hydrateLocationIfEmpty({
          address: next.location,
          city: next.location,
          zip: next.zip,
        }),
      );
    }
    setAnswers(answersFromIntent(next));
  }, [dispatch, initialCategory, initialJob, initialLocation, initialQuery, initialZip]);

  useEffect(() => {
    setPage(1);
    setServicePage(1);
  }, [answers, categories, location, minPrice, maxPrice, minRating, query, sort, zip]);

  useEffect(() => {
    if (skipUrlRef.current) {
      skipUrlRef.current = false;
      return;
    }

    const href = servicesHref({
      confidence: featuredJob ? "exact-job" : activeCategory ? "exact-category" : "related",
      query,
      service: activeCategory || undefined,
      job: subOption?.job ?? subOption?.value,
      zip: zip || extractZip(location),
      location,
    });
    if (`${window.location.pathname}${window.location.search}` !== href) {
      router.replace(href, { scroll: false });
    }
  }, [activeCategory, featuredJob, location, query, router, subOption, zip]);

  function applyIntent(intent: SearchIntent) {
    setQuery(intent.query);
    setCategories(intent.service ? [intent.service] : []);
    if (intent.service && intent.job) {
      const sub = findSubServiceValue(intent.service, intent.query, intent.job);
      setAnswers((current) => (sub ? { ...current, "sub-service": sub } : current));
    } else {
      setAnswers((current) => {
        const next = { ...current };
        delete next["sub-service"];
        return next;
      });
    }
    setAsking(true);
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goToServicePage(next: number) {
    setServicePage(next);
    setPage(1);
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goToPage(next: number) {
    setPage(next);
    professionalsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleCategory(slug: string) {
    setCategories((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug],
    );
    setAnswers({});
  }

  function setAnswer(id: string, value: string) {
    setAnswers((current) => {
      if (current[id] === value) {
        const next = { ...current };
        delete next[id];
        return next;
      }
      return { ...current, [id]: value };
    });
  }

  function resetFilters() {
    setQuery("");
    setCategories([]);
    dispatch(clearLocation());
    setMinPrice(priceBounds.min);
    setMaxPrice(priceBounds.max);
    setMinRating(0);
    setSort("price-asc");
    setAnswers({});
  }

  const activeChips = [
    ...categories.map((slug) => ({
      key: `cat-${slug}`,
      label: serviceCategories.find((item) => item.slug === slug)?.name ?? slug,
      clear: () => toggleCategory(slug),
    })),
    ...Object.entries(answers).flatMap(([id, value]) => {
      const filter = [...commonFilters, ...serviceFilters].find((item) => item.id === id);
      const option = filter?.options.find((item) => item.value === value);
      if (!filter || !option) return [];
      return [
        {
          key: id,
          label: option.label,
          clear: () => setAnswer(id, value),
        },
      ];
    }),
    ...(query.trim()
      ? [{ key: "query", label: `“${query.trim()}”`, clear: () => setQuery("") }]
      : []),
    ...(location.trim()
      ? [{ key: "location", label: location.trim(), clear: () => dispatch(clearLocation()) }]
      : []),
    ...(minRating
      ? [{ key: "rating", label: `${minRating}★ & up`, clear: () => setMinRating(0) }]
      : []),
  ];

  const filtersPanel = () => (
    <>
      <div className="flex items-center justify-between gap-3 border-b pb-3.5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ListFilter className="size-4 text-brand" aria-hidden="true" />
          Filters
        </h2>
        <button
          type="button"
          onClick={resetFilters}
          className="text-sm font-medium text-brand transition-colors hover:text-foreground"
        >
          Reset
        </button>
      </div>

      <form className="flex flex-col" onSubmit={(event) => event.preventDefault()}>
        <FilterBlock title="Service" icon={Wrench}>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm transition-colors hover:bg-muted">
            <Checkbox
              checked={categories.length === 0}
              onCheckedChange={() => {
                setCategories([]);
                setAnswers({});
              }}
            />
            All services
          </label>
          {serviceCategories.map((category) => (
            <label
              key={category.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm transition-colors hover:bg-muted"
            >
              <Checkbox
                checked={categories.includes(category.slug)}
                onCheckedChange={() => toggleCategory(category.slug)}
              />
              {category.name}
            </label>
          ))}
        </FilterBlock>

        {serviceFilters
          .filter((filter) => filter.id === "sub-service")
          .map((filter) => (
            <FilterBlock key={filter.id} title={filter.label} icon={Wrench}>
              <RadioFilter
                filter={filter}
                value={answers[filter.id] ?? ""}
                onChange={(value) => setAnswer(filter.id, value)}
              />
            </FilterBlock>
          ))}

        {commonFilters.map((filter) => (
          <FilterBlock key={filter.id} title={filter.label} icon={Clock}>
            <RadioFilter
              filter={filter}
              value={answers[filter.id] ?? ""}
              onChange={(value) => setAnswer(filter.id, value)}
            />
          </FilterBlock>
        ))}

        {serviceFilters
          .filter((filter) => filter.id !== "sub-service")
          .map((filter) => (
            <FilterBlock key={filter.id} title={filter.label} icon={Wrench}>
              <RadioFilter
                filter={filter}
                value={answers[filter.id] ?? ""}
                onChange={(value) => setAnswer(filter.id, value)}
              />
            </FilterBlock>
          ))}

        <FilterBlock title="Price range" icon={Tag}>
          <Slider
            className="mt-1 mb-1"
            min={priceBounds.min}
            max={priceBounds.max}
            step={10}
            minStepsBetweenThumbs={1}
            value={[minPrice, maxPrice]}
            aria-label="Price range"
            onValueChange={([next, last]) => {
              setMinPrice(next);
              setMaxPrice(last);
            }}
          />
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums">{formatStartingPrice(minPrice)}</span>
            <span className="tabular-nums">{formatStartingPrice(maxPrice)}</span>
          </div>
        </FilterBlock>

        <FilterBlock title="Ratings" icon={Star}>
          {ratingFilters.map(({ rating, count }) => (
            <label
              key={rating}
              className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-1.5 py-1.5 text-sm transition-colors hover:bg-muted"
            >
              <span className="flex items-center gap-2.5">
                <Checkbox
                  checked={minRating === rating}
                  onCheckedChange={(checked) =>
                    setMinRating(checked === true ? rating : 0)
                  }
                />
                <span className="flex items-center gap-0.5 text-warning">
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star
                      key={index}
                      className={cn(
                        "size-3.5",
                        index < rating
                          ? "fill-current"
                          : "text-muted-foreground/40",
                      )}
                    />
                  ))}
                </span>
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                ({String(count).padStart(2, "0")})
              </span>
            </label>
          ))}
        </FilterBlock>
      </form>
    </>
  );

  return (
    <>
      <ServicesHero
        query={query}
        onSearch={applyIntent}
      />

      <ServicesQualifyDialog
        open={asking}
        categorySlug={activeCategory}
        initialAnswers={answers}
        onClose={() => setAsking(false)}
        onComplete={(next, slug) => {
          setAnswers(next);
          if (slug) setCategories([slug]);
          writePendingQuote({
            ...next,
            service: slug,
            job: next["sub-service"] || next.job || "",
            zip,
          });
          setAsking(false);
        }}
      />

      <section className="bg-[#f5f5f5] py-6 md:py-8">
        <Container className="grid items-start gap-6 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-7">
          <aside
            data-filters-sidebar
            data-lenis-prevent
            data-lenis-prevent-wheel
            data-lenis-prevent-touch
            tabIndex={0}
            className="filters-sidebar max-lg:hidden sticky top-24 self-start rounded-xl border bg-card p-5 shadow-sm"
            style={{ maxHeight: "calc(100dvh - 7rem)", overflowY: "scroll" }}
          >
            {filtersPanel()}
          </aside>

          <div className="flex min-w-0 flex-col gap-5" ref={resultsRef}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold">
                  {featuredJob
                    ? `${featuredJob.job} · ${featuredJob.category.name}`
                    : selectedCategory
                      ? `${selectedCategory.name} services`
                      : "Services"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {featuredJob
                    ? `Exact service match, plus ${results.length} ${results.length === 1 ? "professional" : "professionals"}`
                    : `${directoryJobs.length} ${directoryJobs.length === 1 ? "service" : "services"} · ${results.length} ${results.length === 1 ? "professional" : "professionals"}`}
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setFiltersOpen((open) => !open)}
                >
                  <ListFilter data-icon="inline-start" />
                  Filters
                </Button>
                <label className="flex items-center gap-2 text-sm">
                  <span className="hidden sm:block">Sort</span>
                  <NativeSelect
                    value={sort}
                    aria-label="Sort services"
                    onChange={(event) => setSort(event.target.value as SortKey)}
                  >
                    <NativeSelectOption value="price-asc">
                      Price Low to High
                    </NativeSelectOption>
                    <NativeSelectOption value="price-desc">
                      Price High to Low
                    </NativeSelectOption>
                    <NativeSelectOption value="rating">
                      Rating
                    </NativeSelectOption>
                  </NativeSelect>
                </label>

                <div
                  className="flex items-center gap-1.5"
                  role="group"
                  aria-label="Result layout"
                >
                  {viewOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-label={option.label}
                      aria-pressed={view === option.value}
                      onClick={() => setView(option.value)}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-lg border transition-colors",
                        view === option.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                      )}
                    >
                      <option.icon className="size-4" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {Object.keys(answers).length && activeCategory ? (
              <div className="flex flex-col gap-3 rounded-xl border border-[#003F7D]/15 bg-[#e8eef5] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#003F7D]">Send these answers as a quote request</p>
                  <p className="text-sm text-muted-foreground">
                    Matching companies will see the job details and can send a written estimate.
                  </p>
                </div>
                <Button size="sm" asChild>
                  <Link
                    href={`/get-a-quote?service=${activeCategory}${zip ? `&zip=${zip}` : ""}${
                      answers["sub-service"] ? `&job=${answers["sub-service"]}` : ""
                    }`}
                  >
                    Finish quote request
                  </Link>
                </Button>
              </div>
            ) : null}

            {filtersOpen ? (
              <div
                data-lenis-prevent
                data-lenis-prevent-wheel
                data-lenis-prevent-touch
                className="max-h-[min(28rem,70dvh)] overflow-y-auto overscroll-contain rounded-xl border bg-card p-5 shadow-sm lg:hidden"
              >
                {filtersPanel()}
              </div>
            ) : null}

            {activeChips.length ? (
              <ul className="flex flex-wrap items-center gap-2">
                {activeChips.map((chip) => (
                  <li key={chip.key}>
                    <button
                      type="button"
                      onClick={chip.clear}
                      className="inline-flex items-center gap-1.5 rounded-lg border bg-card py-1.5 pr-2 pl-3 text-sm transition-colors hover:border-primary/40"
                    >
                      {chip.label}
                      <X className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="px-2 text-sm font-medium text-brand hover:text-foreground"
                  >
                    Clear all
                  </button>
                </li>
              </ul>
            ) : null}

            {featuredJob || pageJobs.length || pageItems.length ? (
              <>
                {featuredJob ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-muted-foreground">Matched service</p>
                    <ServiceJobCard
                      category={featuredJob.category}
                      job={featuredJob.job}
                      index={featuredJob.index}
                      layout="list"
                    />
                  </div>
                ) : pageJobs.length ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      {selectedCategory ? `${selectedCategory.name} services` : "Browse services"}
                    </p>
                    <ul
                      key={`jobs-${activeCategory}-${currentServicePage}-${view}`}
                      className={
                        view === "grid"
                          ? "reveal-list grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
                          : "reveal-list flex flex-col gap-5"
                      }
                    >
                      {pageJobs.map((item) => (
                        <li key={`${item.category.slug}-${item.slug}`}>
                          <ServiceJobCard
                            category={item.category}
                            job={item.job}
                            index={item.index}
                            layout={view}
                          />
                        </li>
                      ))}
                    </ul>
                    <DirectoryPagination
                      page={currentServicePage}
                      pageCount={servicePageCount}
                      onPage={goToServicePage}
                      label="Service pages"
                    />
                  </div>
                ) : null}

                {pageItems.length ? (
                  <div className="flex flex-col gap-3" ref={professionalsRef}>
                    <p className="text-sm font-medium text-muted-foreground">
                      Matching professionals
                    </p>
                    <ul
                      key={`pros-${activeCategory}-${currentPage}-${view}`}
                      className={
                        view === "grid"
                          ? "reveal-list grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
                          : "reveal-list flex flex-col gap-5"
                      }
                    >
                      {pageItems.map((provider) => (
                        <li key={provider.id}>
                          <ProviderCard
                            provider={provider}
                            visual={view === "grid"}
                            place={parsePlaceInput(location || zip)}
                          />
                        </li>
                      ))}
                    </ul>
                    <DirectoryPagination
                      page={currentPage}
                      pageCount={pageCount}
                      onPage={goToPage}
                      label="Professional pages"
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-5 py-14 text-center shadow-sm">
                <p className="text-base font-medium">No professionals match those filters</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Try a different service, or clear the category and rating filters.
                </p>
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Reset filters
                </Button>
              </div>
            )}
          </div>
        </Container>
      </section>
    </>
  );
}
