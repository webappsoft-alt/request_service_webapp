import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import {
  extractErrorMessage,
  getData,
} from "@/components/api/apiFuntions";
import { publicApi } from "@/components/api/ApiRoutesFile";

export type PublicFixedServiceSortBy =
  | "recommended"
  | "price_asc"
  | "price_desc"
  | "rating"
  | "distance"
  | "newest";

export type PublicFixedServiceCategory = {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  image?: string;
};

export type PublicFixedServiceProvider = {
  id: string;
  companyName: string;
  slug: string;
  tagline: string;
  description?: string;
  rating: {
    average: number;
    totalReviews: number;
  };
  location: {
    city: string;
    country: string;
    zip: string;
    address: string;
    coordinates: [number, number] | number[];
  };
  profile: {
    yearsInBusiness: number;
    licensed: boolean;
    insured: boolean;
  };
};

export type PublicFixedService = {
  id: string;
  servicesName: string;
  slug: string;
  category: PublicFixedServiceCategory | null;
  subcategory: PublicFixedServiceCategory | null;
  price: number;
  unit: string;
  images: string[];
  covered: string[];
  commonServices: string[];
  workingArea: string[];
  availabilityType: string;
  provider: PublicFixedServiceProvider | null;
  distanceMiles: number | null;
  createdAt?: string;
};

export type PublicFixedServicesQuery = {
  search?: string;
  zipCode?: string;
  lat?: number | null;
  lng?: number | null;
  radius?: number;
  /** Category ObjectIds — always sent as a string[] to the API. */
  category?: string[];
  subCategory?: string;
  commonServices?: string;
  workingArea?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  availability?: string;
  sortBy?: PublicFixedServiceSortBy;
  /**
   * Client-only token so location select/clear refetches even when zip is empty.
   * Never sent to the API.
   */
  locationToken?: string;
};

type PublicFixedServicesState = {
  items: PublicFixedService[];
  query: PublicFixedServicesQuery;
  queryKey: string;
  /** Query key of the in-flight non-append request (blocks duplicate loops). */
  requestKey: string | null;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  loading: boolean;
  loadingMore: boolean;
  loaded: boolean;
  error: string | null;
  /** Stashed / fetched service for the detail page (keyed by slug). */
  detail: PublicFixedService | null;
  detailLoading: boolean;
  detailError: string | null;
};

export const PUBLIC_FIXED_SERVICES_LIMIT = 10;

const initialQuery: PublicFixedServicesQuery = {
  sortBy: "recommended",
};

const initialState: PublicFixedServicesState = {
  items: [],
  query: initialQuery,
  queryKey: buildPublicFixedServicesQueryKey(initialQuery),
  requestKey: null,
  page: 0,
  limit: PUBLIC_FIXED_SERVICES_LIMIT,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  loading: false,
  loadingMore: false,
  loaded: false,
  error: null,
  detail: null,
  detailLoading: false,
  detailError: null,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && Boolean(item.trim()),
  );
}

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeCategory(raw: unknown): PublicFixedServiceCategory | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id =
    (typeof record.id === "string" && record.id) ||
    (typeof record._id === "string" && record._id) ||
    "";
  if (!id && typeof record.slug !== "string" && typeof record.name !== "string") {
    return null;
  }
  return {
    id,
    name: typeof record.name === "string" ? record.name : "",
    slug: typeof record.slug === "string" ? record.slug : "",
    icon: typeof record.icon === "string" ? record.icon : undefined,
    image: typeof record.image === "string" ? record.image : undefined,
  };
}

function normalizeProvider(raw: unknown): PublicFixedServiceProvider | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id =
    (typeof record.id === "string" && record.id) ||
    (typeof record._id === "string" && record._id) ||
    "";
  if (!id) return null;

  const rating = asRecord(record.rating) ?? {};
  const location = asRecord(record.location) ?? {};
  const profile = asRecord(record.profile) ?? {};
  const coordinates = Array.isArray(location.coordinates)
    ? (location.coordinates as number[])
    : [];

  return {
    id,
    companyName:
      typeof record.companyName === "string" ? record.companyName : "",
    slug: typeof record.slug === "string" ? record.slug : "",
    tagline: typeof record.tagline === "string" ? record.tagline : "",
    description:
      typeof record.description === "string" ? record.description : undefined,
    rating: {
      average: toNumber(rating.average, 0),
      totalReviews: toNumber(rating.totalReviews, 0),
    },
    location: {
      city: typeof location.city === "string" ? location.city : "",
      country: typeof location.country === "string" ? location.country : "",
      zip: typeof location.zip === "string" ? location.zip : "",
      address: typeof location.address === "string" ? location.address : "",
      coordinates,
    },
    profile: {
      yearsInBusiness: toNumber(profile.yearsInBusiness, 0),
      licensed: Boolean(profile.licensed),
      insured: Boolean(profile.insured),
    },
  };
}

export function normalizePublicFixedService(
  raw: unknown,
): PublicFixedService | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id =
    (typeof record.id === "string" && record.id) ||
    (typeof record._id === "string" && record._id) ||
    "";
  if (!id) return null;

  return {
    id,
    servicesName:
      typeof record.servicesName === "string" ? record.servicesName : "",
    slug: typeof record.slug === "string" ? record.slug : "",
    category: normalizeCategory(record.category),
    subcategory: normalizeCategory(record.subcategory),
    price: toNumber(record.price, 0),
    unit: typeof record.unit === "string" ? record.unit : "",
    images: toStringArray(record.images),
    covered: toStringArray(record.covered),
    commonServices: toStringArray(record.commonServices),
    workingArea: toStringArray(record.workingArea),
    availabilityType:
      typeof record.availabilityType === "string"
        ? record.availabilityType
        : "",
    provider: normalizeProvider(record.provider),
    distanceMiles:
      record.distanceMiles == null ? null : toNumber(record.distanceMiles, 0),
    createdAt: typeof record.createdAt === "string" ? record.createdAt : undefined,
  };
}

/**
 * Public fixed-services payload shape:
 * `{ data: Service[], meta: { totalRecords, totalPages, currentPage, limit, hasNextPage, hasPrevPage } }`
 */
function parsePublicFixedServicesResponse(response: unknown): {
  items: PublicFixedService[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
} {
  const root = asRecord(response) ?? {};
  const nested = asRecord(root.data);

  // List lives under `data` (array). Support a nested `{ data: [] }` wrapper too.
  const rawList: unknown[] =
    (Array.isArray(root.data) && root.data) ||
    (nested && Array.isArray(nested.data) && nested.data) ||
    (Array.isArray(root.fixedServices) && root.fixedServices) ||
    (Array.isArray(response) && response) ||
    [];

  // Pagination key is `meta` (not `pagination`). Keep pagination as legacy fallback.
  const meta =
    asRecord(root.meta) ??
    (nested ? asRecord(nested.meta) : null) ??
    asRecord(root.pagination) ??
    {};

  const items = rawList
    .map(normalizePublicFixedService)
    .filter((item): item is PublicFixedService => Boolean(item));

  const page = Math.max(1, toNumber(meta.currentPage ?? meta.page, 1));
  const limit = Math.max(
    1,
    toNumber(meta.limit, PUBLIC_FIXED_SERVICES_LIMIT),
  );
  const total = Math.max(
    0,
    toNumber(meta.totalRecords ?? meta.totalDocs ?? meta.total, items.length),
  );

  let totalPages = Math.max(0, toNumber(meta.totalPages, 0));
  if (!totalPages && total > 0) {
    totalPages = Math.max(1, Math.ceil(total / limit));
  }
  if (!totalPages) totalPages = 1;

  const rawNext = meta.hasNextPage;
  const hasNextPage =
    rawNext === true ||
    rawNext === "true" ||
    (rawNext !== false &&
      rawNext !== "false" &&
      (page < totalPages || page * limit < total));

  return { items, page, limit, total, totalPages, hasNextPage };
}

/** Detail payload: `{ success, data: Service }` or bare service object. */
function extractDetailEntity(response: unknown): PublicFixedService | null {
  const root = asRecord(response) ?? {};
  if (root.data != null && !Array.isArray(root.data)) {
    return normalizePublicFixedService(root.data);
  }
  return normalizePublicFixedService(response);
}

/** Customer detail URL: `/services/{categorySlug}/{serviceSlug}`. */
export function publicFixedServicePath(service: PublicFixedService): string {
  const categorySlug =
    service.category?.slug?.trim() ||
    service.category?.name?.trim().toLowerCase().replace(/\s+/g, "-") ||
    "services";
  const serviceSlug = service.slug?.trim();
  if (!serviceSlug) return "/services";
  return `/services/${categorySlug}/${serviceSlug}`;
}

export function selectPublicFixedServiceBySlug(
  state: { publicFixedServices?: PublicFixedServicesState },
  slug: string,
): PublicFixedService | null {
  const slice = state.publicFixedServices;
  if (!slice || !slug) return null;
  if (slice.detail?.slug === slug) return slice.detail;
  return slice.items.find((item) => item.slug === slug) ?? null;
}

export function buildPublicFixedServicesQueryKey(
  query: PublicFixedServicesQuery,
): string {
  const normalized: Record<string, string | number> = {};
  const entries = Object.entries(query).sort(([a], [b]) => a.localeCompare(b));
  for (const [key, value] of entries) {
    if (value == null || value === "") continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    if (Array.isArray(value)) {
      if (!value.length) continue;
      normalized[key] = JSON.stringify(value);
      continue;
    }
    normalized[key] = value as string | number;
  }
  return JSON.stringify(normalized);
}

function toRequestParams(
  query: PublicFixedServicesQuery,
  page: number,
  limit: number,
): Record<string, string | number | boolean | null | undefined> {
  const categoryIds = (query.category ?? [])
    .map((id) => String(id).trim())
    .filter(Boolean);

  return {
    page,
    limit,
    search: query.search?.trim() || undefined,
    q: undefined,
    // Omit when cleared so the previous zip/geo is not reused.
    zipCode: query.zipCode?.trim() || undefined,
    lat:
      query.lat != null && Number.isFinite(query.lat) ? query.lat : undefined,
    lng:
      query.lng != null && Number.isFinite(query.lng) ? query.lng : undefined,
    radius: undefined,
    // Same getData pattern as pro. category stays the key; value is
    // array-of-id strings encoded as JSON: ["id1","id2"].
    category: categoryIds.length ? JSON.stringify(categoryIds) : undefined,
    subCategory: query.subCategory?.trim() || undefined,
    commonServices: query.commonServices?.trim() || undefined,
    workingArea: query.workingArea?.trim() || undefined,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    rating: query.rating,
    availability: query.availability?.trim() || undefined,
    sortBy: query.sortBy || "recommended",
  };
}

export type FetchPublicFixedServicesArg = {
  query?: PublicFixedServicesQuery;
  append?: boolean;
};

export type FetchPublicFixedServicesResult = {
  items: PublicFixedService[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  append: boolean;
  query: PublicFixedServicesQuery;
  queryKey: string;
};

type LiveLocationState = {
  address: string;
  zip: string;
  city: string;
  state: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
};

/**
 * Build the Fixed Services query from the latest Redux location at request time.
 * Never inherits prior zip/lat/lng from the slice's cached query.
 */
function resolveQueryWithLiveLocation(
  incoming: PublicFixedServicesQuery | undefined,
  location: LiveLocationState,
  fallbackSortBy?: PublicFixedServiceSortBy,
): PublicFixedServicesQuery {
  const nextQuery: PublicFixedServicesQuery = {
    sortBy: incoming?.sortBy || fallbackSortBy || "recommended",
    ...incoming,
    zipCode: location.zip.trim() || undefined,
    lat:
      location.latitude != null && Number.isFinite(location.latitude)
        ? location.latitude
        : undefined,
    lng:
      location.longitude != null && Number.isFinite(location.longitude)
        ? location.longitude
        : undefined,
    locationToken: [
      location.address,
      location.city,
      location.zip,
      location.state,
      location.country,
      location.latitude ?? "",
      location.longitude ?? "",
    ].join("|"),
  };

  // Cleared location must not keep a previous zip/geo via undefined merges.
  if (!location.zip.trim()) delete nextQuery.zipCode;
  if (location.latitude == null || !Number.isFinite(location.latitude)) {
    delete nextQuery.lat;
  }
  if (location.longitude == null || !Number.isFinite(location.longitude)) {
    delete nextQuery.lng;
  }

  return nextQuery;
}

export const fetchPublicFixedServices = createAsyncThunk<
  FetchPublicFixedServicesResult,
  FetchPublicFixedServicesArg | void,
  {
    state: {
      publicFixedServices: PublicFixedServicesState;
      location: LiveLocationState;
    };
    rejectValue: string;
  }
>(
  "publicFixedServices/fetch",
  async (arg, { getState, rejectWithValue }) => {
    const append = Boolean(arg && typeof arg === "object" && arg.append);
    const root = getState();
    const state = root.publicFixedServices;
    const location = root.location;
    const incoming =
      arg && typeof arg === "object" ? arg.query : undefined;

    const nextQuery: PublicFixedServicesQuery = append
      ? { ...state.query, ...incoming }
      : resolveQueryWithLiveLocation(
          incoming,
          location,
          state.query.sortBy,
        );

    const queryKey = buildPublicFixedServicesQueryKey(nextQuery);
    const page = append ? state.page + 1 : 1;
    const limit = state.limit || PUBLIC_FIXED_SERVICES_LIMIT;

    try {
      const response = await getData(
        publicApi.fixedServices,
        toRequestParams(nextQuery, page, limit),
        { silent: true },
      );
      const parsed = parsePublicFixedServicesResponse(response);
      return {
        items: parsed.items,
        page: parsed.page,
        limit: parsed.limit,
        total: parsed.total,
        totalPages: parsed.totalPages,
        hasNextPage: parsed.hasNextPage,
        append,
        query: nextQuery,
        queryKey,
      };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (arg, { getState }) => {
      const append = Boolean(arg && typeof arg === "object" && arg.append);
      const root = getState();
      const state = root.publicFixedServices;
      if (append) {
        if (state.loading || state.loadingMore) return false;
        if (!state.hasNextPage) return false;
        return true;
      }
      const incoming =
        arg && typeof arg === "object" ? arg.query : undefined;
      const nextQuery = resolveQueryWithLiveLocation(
        incoming,
        root.location,
        state.query.sortBy,
      );
      const queryKey = buildPublicFixedServicesQueryKey(nextQuery);
      if (state.requestKey === queryKey) return false;
      if (state.loaded && state.queryKey === queryKey) return false;
      return true;
    },
  },
);

/**
 * Fallback for direct URL / refresh when listing state is unavailable.
 * Skips the network call when detail or list items already hold this slug.
 */
export const fetchPublicFixedServiceBySlug = createAsyncThunk<
  PublicFixedService,
  string,
  {
    state: { publicFixedServices: PublicFixedServicesState };
    rejectValue: string;
  }
>(
  "publicFixedServices/fetchBySlug",
  async (slug, { rejectWithValue }) => {
    const trimmed = String(slug || "").trim();
    if (!trimmed) {
      return rejectWithValue("Service slug is required.");
    }
    try {
      const response = await getData(
        publicApi.fixedService(trimmed),
        undefined,
        { silent: true },
      );
      const entity = extractDetailEntity(response);
      if (!entity) {
        return rejectWithValue("Service not found.");
      }
      return entity;
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (slug, { getState }) => {
      const trimmed = String(slug || "").trim();
      if (!trimmed) return false;
      const state = getState().publicFixedServices;
      if (state.detailLoading) return false;
      if (state.detail?.slug === trimmed) return false;
      if (state.items.some((item) => item.slug === trimmed)) return false;
      return true;
    },
  },
);

const publicFixedServicesSlice = createSlice({
  name: "publicFixedServices",
  initialState,
  reducers: {
    setPublicFixedServicesQuery(
      state,
      action: PayloadAction<PublicFixedServicesQuery>,
    ) {
      state.query = { ...state.query, ...action.payload };
      state.queryKey = buildPublicFixedServicesQueryKey(state.query);
      state.loaded = false;
      state.error = null;
    },
    /** Stash listing card data so the detail page can render without a fetch. */
    setPublicFixedServiceDetail(
      state,
      action: PayloadAction<PublicFixedService>,
    ) {
      state.detail = action.payload;
      state.detailLoading = false;
      state.detailError = null;
    },
    clearPublicFixedServiceDetail(state) {
      state.detail = null;
      state.detailLoading = false;
      state.detailError = null;
    },
    clearPublicFixedServicesError(state) {
      state.error = null;
      state.detailError = null;
    },
    resetPublicFixedServices() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPublicFixedServices.pending, (state, action) => {
        const append = Boolean(
          action.meta.arg &&
            typeof action.meta.arg === "object" &&
            action.meta.arg.append,
        );
        if (append) {
          state.loadingMore = true;
        } else {
          const incoming =
            action.meta.arg && typeof action.meta.arg === "object"
              ? action.meta.arg.query
              : undefined;
          // Do not merge previous query — avoids sticky old zip/lat/lng on requestKey.
          const nextQuery: PublicFixedServicesQuery = incoming
            ? { ...incoming }
            : { ...state.query };
          state.requestKey = buildPublicFixedServicesQueryKey(nextQuery);
          state.loading = true;
          state.items = [];
          state.total = 0;
          state.page = 0;
          state.hasNextPage = false;
        }
        state.error = null;
      })
      .addCase(fetchPublicFixedServices.fulfilled, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        state.requestKey = null;
        state.loaded = true;
        state.query = action.payload.query;
        state.queryKey = action.payload.queryKey;
        state.page = action.payload.page;
        state.limit = action.payload.limit;
        state.total = action.payload.total;
        state.totalPages = action.payload.totalPages;
        state.hasNextPage = action.payload.hasNextPage;

        if (action.payload.append) {
          const seen = new Set(state.items.map((item) => item.id));
          for (const item of action.payload.items) {
            if (!seen.has(item.id)) {
              state.items.push(item);
              seen.add(item.id);
            }
          }
          return;
        }

        state.items = action.payload.items;
      })
      .addCase(fetchPublicFixedServices.rejected, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        state.requestKey = null;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to load services.";
      })
      .addCase(fetchPublicFixedServiceBySlug.pending, (state) => {
        state.detailLoading = true;
        state.detailError = null;
      })
      .addCase(fetchPublicFixedServiceBySlug.fulfilled, (state, action) => {
        state.detailLoading = false;
        state.detail = action.payload;
        state.detailError = null;
      })
      .addCase(fetchPublicFixedServiceBySlug.rejected, (state, action) => {
        state.detailLoading = false;
        state.detailError =
          action.payload ||
          action.error.message ||
          "Failed to load service.";
      });
  },
});

export const {
  setPublicFixedServicesQuery,
  setPublicFixedServiceDetail,
  clearPublicFixedServiceDetail,
  clearPublicFixedServicesError,
  resetPublicFixedServices,
} = publicFixedServicesSlice.actions;

export const selectPublicFixedServices = (state: {
  publicFixedServices?: PublicFixedServicesState;
}) => state.publicFixedServices?.items ?? [];

export default publicFixedServicesSlice.reducer;
