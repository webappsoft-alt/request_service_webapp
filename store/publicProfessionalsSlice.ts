import {
  createAsyncThunk,
  createSlice,
} from "@reduxjs/toolkit";
import {
  extractErrorMessage,
  getData,
} from "@/components/api/apiFuntions";
import { publicApi } from "@/components/api/ApiRoutesFile";
import { getServiceCategoryById } from "@/lib/data/services";
import type { Provider } from "@/lib/types";

export type PublicProfessionalSortBy =
  | "recommended"
  | "rating"
  | "experience"
  | "completed_jobs"
  | "distance"
  | "newest";

export type PublicProfessional = {
  id: string;
  userId: string;
  fullName: string;
  companyName: string;
  slug: string;
  tagline: string;
  avatarUrl: string;
  verificationBadge: {
    isVerified: boolean;
    status: string;
    licensed: boolean;
    insured: boolean;
  };
  tradeDetails: {
    primaryCategory: {
      id: string;
      name: string;
      slug: string;
    } | null;
    tradeTitle: string;
    specialties: string[];
  };
  performanceMetrics: {
    rating: {
      average: number;
      totalReviews: number;
    };
    completedJobs: number;
  };
  location: {
    city: string;
    country: string;
    zip: string;
    address: string;
    coordinates: [number, number] | number[];
    operatingCities: string[];
    coveredZipCodes: string[];
    distanceMiles: number | null;
  };
  activeOfferings: {
    activeServicesCount: number;
    startingPrice: number;
    startingPriceDisplay: string;
  };
  createdAt?: string;
};

export type PublicProfessionalsQuery = {
  search?: string;
  zipCode?: string;
  lat?: number | null;
  lng?: number | null;
  radius?: number;
  /** Category ObjectId (or slug) — send ID from Categories API. */
  category?: string;
  subCategory?: string;
  commonServices?: string;
  workingArea?: string;
  minRating?: number;
  isIdentityVerified?: boolean;
  availability?: string;
  sortBy?: PublicProfessionalSortBy;
  sortOrder?: "asc" | "desc";
  /** Client-only token so location select/clear refetches. Never sent to API. */
  locationToken?: string;
};

type PublicProfessionalsState = {
  items: PublicProfessional[];
  query: PublicProfessionalsQuery;
  queryKey: string;
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
};

export const PUBLIC_PROFESSIONALS_LIMIT = 10;

const initialQuery: PublicProfessionalsQuery = {
  sortBy: "recommended",
};

const initialState: PublicProfessionalsState = {
  items: [],
  query: initialQuery,
  queryKey: buildPublicProfessionalsQueryKey(initialQuery),
  requestKey: null,
  page: 0,
  limit: PUBLIC_PROFESSIONALS_LIMIT,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  loading: false,
  loadingMore: false,
  loaded: false,
  error: null,
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

function normalizePrimaryCategory(
  raw: unknown,
): PublicProfessional["tradeDetails"]["primaryCategory"] {
  if (typeof raw === "string" && raw.trim()) {
    const id = raw.trim();
    return { id, name: "", slug: id };
  }
  const record = asRecord(raw);
  if (!record) return null;
  const id =
    (typeof record.id === "string" && record.id) ||
    (typeof record._id === "string" && record._id) ||
    "";
  if (!id && typeof record.name !== "string" && typeof record.slug !== "string") {
    return null;
  }
  return {
    id,
    name: typeof record.name === "string" ? record.name : "",
    slug: typeof record.slug === "string" ? record.slug : "",
  };
}

export function normalizePublicProfessional(
  raw: unknown,
): PublicProfessional | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id =
    (typeof record.id === "string" && record.id) ||
    (typeof record._id === "string" && record._id) ||
    "";
  if (!id) return null;

  const badge = asRecord(record.verificationBadge) ?? {};
  const trade = asRecord(record.tradeDetails) ?? {};
  const metrics = asRecord(record.performanceMetrics) ?? {};
  const rating = asRecord(metrics.rating) ?? {};
  const location = asRecord(record.location) ?? {};
  const offerings = asRecord(record.activeOfferings) ?? {};
  const coordinates = Array.isArray(location.coordinates)
    ? (location.coordinates as number[])
    : [];

  return {
    id,
    userId: typeof record.userId === "string" ? record.userId : "",
    fullName: typeof record.fullName === "string" ? record.fullName : "",
    companyName:
      typeof record.companyName === "string" ? record.companyName : "",
    slug: typeof record.slug === "string" ? record.slug : "",
    tagline: typeof record.tagline === "string" ? record.tagline : "",
    avatarUrl: typeof record.avatarUrl === "string" ? record.avatarUrl : "",
    verificationBadge: {
      isVerified: Boolean(badge.isVerified),
      status: typeof badge.status === "string" ? badge.status : "",
      licensed: Boolean(badge.licensed),
      insured: Boolean(badge.insured),
    },
    tradeDetails: {
      primaryCategory: normalizePrimaryCategory(trade.primaryCategory),
      tradeTitle: typeof trade.tradeTitle === "string" ? trade.tradeTitle : "",
      specialties: toStringArray(trade.specialties),
    },
    performanceMetrics: {
      rating: {
        average: toNumber(rating.average, 0),
        totalReviews: toNumber(rating.totalReviews, 0),
      },
      completedJobs: toNumber(metrics.completedJobs, 0),
    },
    location: {
      city: typeof location.city === "string" ? location.city : "",
      country: typeof location.country === "string" ? location.country : "",
      zip: typeof location.zip === "string" ? location.zip : "",
      address: typeof location.address === "string" ? location.address : "",
      coordinates,
      operatingCities: toStringArray(location.operatingCities),
      coveredZipCodes: toStringArray(location.coveredZipCodes),
      distanceMiles:
        location.distanceMiles == null
          ? null
          : toNumber(location.distanceMiles, 0),
    },
    activeOfferings: {
      activeServicesCount: toNumber(offerings.activeServicesCount, 0),
      startingPrice: toNumber(offerings.startingPrice, 0),
      startingPriceDisplay:
        typeof offerings.startingPriceDisplay === "string"
          ? offerings.startingPriceDisplay
          : "",
    },
    createdAt:
      typeof record.createdAt === "string" ? record.createdAt : undefined,
  };
}

function parsePublicProfessionalsResponse(response: unknown): {
  items: PublicProfessional[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
} {
  const root = asRecord(response) ?? {};
  const nested = asRecord(root.data);

  const rawList: unknown[] =
    (Array.isArray(root.data) && root.data) ||
    (nested && Array.isArray(nested.data) && nested.data) ||
    (Array.isArray(root.professionals) && root.professionals) ||
    (Array.isArray(response) && response) ||
    [];

  const meta =
    asRecord(root.pagination) ??
    asRecord(root.meta) ??
    (nested ? asRecord(nested.pagination) : null) ??
    {};

  const items = rawList
    .map(normalizePublicProfessional)
    .filter((item): item is PublicProfessional => Boolean(item));

  const page = Math.max(1, toNumber(meta.currentPage ?? meta.page, 1));
  const limit = Math.max(1, toNumber(meta.limit, PUBLIC_PROFESSIONALS_LIMIT));
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

export function buildPublicProfessionalsQueryKey(
  query: PublicProfessionalsQuery,
): string {
  const normalized: Record<string, string | number | boolean> = {};
  const entries = Object.entries(query).sort(([a], [b]) => a.localeCompare(b));
  for (const [key, value] of entries) {
    if (value == null || value === "") continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    normalized[key] = value as string | number | boolean;
  }
  return JSON.stringify(normalized);
}

function toRequestParams(
  query: PublicProfessionalsQuery,
  page: number,
  limit: number,
): Record<string, string | number | boolean | null | undefined> {
  return {
    page,
    limit,
    search: query.search?.trim() || undefined,
    q: undefined,
    zipCode: query.zipCode?.trim() || undefined,
    lat:
      query.lat != null && Number.isFinite(query.lat) ? query.lat : undefined,
    lng:
      query.lng != null && Number.isFinite(query.lng) ? query.lng : undefined,
    radius:
      query.radius != null && Number.isFinite(query.radius)
        ? query.radius
        : undefined,
    category: query.category?.trim() || undefined,
    subCategory: query.subCategory?.trim() || undefined,
    commonServices: query.commonServices?.trim() || undefined,
    workingArea: query.workingArea?.trim() || undefined,
    minRating:
      query.minRating != null && query.minRating > 0
        ? query.minRating
        : undefined,
    isIdentityVerified:
      query.isIdentityVerified === true ? true : undefined,
    availability: query.availability?.trim() || undefined,
    sortBy: query.sortBy || "recommended",
    sortOrder: query.sortOrder || "desc",
  };
}

function logoInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "P";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

/** Map API professional → existing Provider shape for map + cards. */
export function publicProfessionalToProvider(
  professional: PublicProfessional,
): Provider {
  const coords = Array.isArray(professional.location.coordinates)
    ? professional.location.coordinates
    : [];
  const lng = toNumber(coords[0], 0);
  const lat = toNumber(coords[1], 0);
  const primary = professional.tradeDetails.primaryCategory;
  const categoryIds = primary?.id ? [primary.id] : [];
  const resolvedCategoryNames = categoryIds
    .map((id) => getServiceCategoryById(id)?.name)
    .filter((name): name is string => Boolean(name));
  // Prefer catalog category names (e.g. Plumbing). Never dump specialties onto the card.
  const serviceLabels = resolvedCategoryNames.length
    ? resolvedCategoryNames.slice(0, 2)
    : [
        primary?.name?.trim() ||
          professional.tradeDetails.tradeTitle?.trim() ||
          professional.tagline?.trim() ||
          "",
      ].filter(Boolean).slice(0, 2);

  return {
    id: professional.id,
    slug: professional.slug || professional.id,
    companyName: professional.companyName || professional.fullName || "Professional",
    logoInitials: logoInitials(
      professional.companyName || professional.fullName || "P",
    ),
    logoUrl: professional.avatarUrl || undefined,
    // Keep cover separate from avatar so cards use category/service photos like before.
    coverImage: undefined,
    startingPrice: professional.activeOfferings.startingPrice || undefined,
    tagline:
      professional.tagline ||
      professional.tradeDetails.tradeTitle ||
      professional.activeOfferings.startingPriceDisplay ||
      "",
    description:
      professional.tagline ||
      professional.activeOfferings.startingPriceDisplay ||
      "",
    rating: professional.performanceMetrics.rating.average,
    reviewCount: professional.performanceMetrics.rating.totalReviews,
    yearsInBusiness: 0,
    licensed: professional.verificationBadge.licensed,
    insured: professional.verificationBadge.insured,
    categoryIds,
    serviceLabels: serviceLabels.length ? serviceLabels : undefined,
    serviceArea: professional.location.coveredZipCodes,
    street: professional.location.address,
    city: professional.location.city,
    state: "",
    zip: professional.location.zip,
    lat,
    lng,
    phone: "",
    email: "",
    workingHours: [],
    gallery: [],
    foundedYear: 0,
    employeeCount: "",
    reviews: [],
  };
}

export type FetchPublicProfessionalsArg = {
  query?: PublicProfessionalsQuery;
  append?: boolean;
};

export type FetchPublicProfessionalsResult = {
  items: PublicProfessional[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  append: boolean;
  query: PublicProfessionalsQuery;
  queryKey: string;
};

export const fetchPublicProfessionals = createAsyncThunk<
  FetchPublicProfessionalsResult,
  FetchPublicProfessionalsArg | undefined,
  {
    state: {
      publicProfessionals: PublicProfessionalsState;
      location: {
        address: string;
        zip: string;
        city: string;
        state: string;
        country: string;
        latitude: number | null;
        longitude: number | null;
      };
    };
    rejectValue: string;
  }
>(
  "publicProfessionals/fetch",
  async (arg, { getState, rejectWithValue }) => {
    const state = getState().publicProfessionals;
    const location = getState().location;
    const append = Boolean(arg?.append);
    const incoming = arg?.query;

    const hasZip = Boolean(location.zip.trim());
    const hasCoords =
      location.latitude != null &&
      Number.isFinite(location.latitude) &&
      location.longitude != null &&
      Number.isFinite(location.longitude);
    const committed =
      hasZip ||
      hasCoords ||
      Boolean(location.city.trim());

    // Never call the directory without a committed location (selected place / geo).
    if (!append && !committed) {
      return rejectWithValue("Location is required.");
    }

    const nextQuery: PublicProfessionalsQuery = append
      ? {
          ...state.query,
          ...incoming,
        }
      : {
          sortBy: "recommended",
          ...incoming,
          // Always prefer live Redux location — do not keep a prior zip via undefined merges.
          zipCode: hasZip ? location.zip.trim() : undefined,
          lat: hasCoords ? location.latitude! : undefined,
          lng: hasCoords ? location.longitude! : undefined,
          locationToken: committed
            ? [
                location.zip,
                location.city,
                location.state,
                location.country,
                location.latitude ?? "",
                location.longitude ?? "",
              ].join("|")
            : "",
        };

    if (!nextQuery.zipCode?.trim()) delete nextQuery.zipCode;
    if (nextQuery.lat == null || !Number.isFinite(nextQuery.lat)) {
      delete nextQuery.lat;
    }
    if (nextQuery.lng == null || !Number.isFinite(nextQuery.lng)) {
      delete nextQuery.lng;
    }
    // Only send minRating when the user picked a Rating filter value.
    if (nextQuery.minRating == null || nextQuery.minRating <= 0) {
      delete nextQuery.minRating;
    }
    if (!nextQuery.locationToken) delete nextQuery.locationToken;

    const queryKey = buildPublicProfessionalsQueryKey(nextQuery);
    const page = append ? state.page + 1 : 1;
    const limit = state.limit || PUBLIC_PROFESSIONALS_LIMIT;

    try {
      const response = await getData(
        publicApi.professionals,
        toRequestParams(nextQuery, page, limit),
        { silent: true },
      );
      const parsed = parsePublicProfessionalsResponse(response);
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
      const state = getState().publicProfessionals;
      const location = getState().location;
      if (arg?.append) {
        return !state.loading && !state.loadingMore && state.hasNextPage;
      }
      const committed =
        Boolean(location.zip.trim()) ||
        Boolean(location.city.trim()) ||
        (location.latitude != null &&
          location.longitude != null &&
          Number.isFinite(location.latitude) &&
          Number.isFinite(location.longitude));
      if (!committed) return false;
      return true;
    },
  },
);

const publicProfessionalsSlice = createSlice({
  name: "publicProfessionals",
  initialState,
  reducers: {
    clearPublicProfessionalsError(state) {
      state.error = null;
    },
    resetPublicProfessionals() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPublicProfessionals.pending, (state, action) => {
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
          const nextQuery: PublicProfessionalsQuery = incoming
            ? { ...incoming }
            : { ...state.query };
          state.requestKey = buildPublicProfessionalsQueryKey(nextQuery);
          state.loading = true;
          if (!state.items.length) {
            state.total = 0;
            state.page = 0;
            state.hasNextPage = false;
          }
        }
        state.error = null;
      })
      .addCase(fetchPublicProfessionals.fulfilled, (state, action) => {
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
      .addCase(fetchPublicProfessionals.rejected, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        state.requestKey = null;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to load professionals.";
      });
  },
});

export const {
  clearPublicProfessionalsError,
  resetPublicProfessionals,
} = publicProfessionalsSlice.actions;

export default publicProfessionalsSlice.reducer;
