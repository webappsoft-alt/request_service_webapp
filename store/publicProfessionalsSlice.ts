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
import { getServiceCategoryById } from "@/lib/data/services";
import type { Provider, Review, WorkingHours } from "@/lib/types";

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
  description: string;
  phone: string;
  email: string;
  website: string;
  contactRole: string;
  avatarUrl: string;
  verificationBadge: {
    isVerified: boolean;
    status: string;
    licensed: boolean;
    insured: boolean;
  };
  profile: {
    yearsInBusiness: number;
    employeeCount: string;
    licensed: boolean;
    insured: boolean;
  };
  tradeDetails: {
    primaryCategory: {
      id: string;
      name: string;
      slug: string;
    } | null;
    categoryIds: string[];
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
  workingHours: WorkingHours[];
  activeServices: Array<{
    id: string;
    servicesName: string;
    slug: string;
    price: number;
    unit: string;
    images: string[];
    category: {
      id: string;
      name: string;
      slug: string;
    } | null;
    commonServices: string[];
    workingArea: string[];
  }>;
  reviews: Review[];
  createdAt?: string;
  updatedAt?: string;
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
  /** Stashed / fetched professional for the profile page (keyed by slug). */
  detail: PublicProfessional | null;
  detailLoading: boolean;
  detailError: string | null;
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

function normalizeWorkingHours(value: unknown): WorkingHours[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) return null;
      const day = typeof record.day === "string" ? record.day : "";
      if (
        day !== "monday" &&
        day !== "tuesday" &&
        day !== "wednesday" &&
        day !== "thursday" &&
        day !== "friday" &&
        day !== "saturday" &&
        day !== "sunday"
      ) {
        return null;
      }
      return {
        day,
        open: typeof record.open === "string" ? record.open : null,
        close: typeof record.close === "string" ? record.close : null,
        closed: Boolean(record.closed),
      } satisfies WorkingHours;
    })
    .filter((item): item is WorkingHours => Boolean(item));
}

function normalizeReview(raw: unknown, providerId: string): Review | null {
  const record = asRecord(raw);
  if (!record) return null;
  const rating = Math.max(1, Math.min(5, toNumber(record.rating, 0)));
  const body = typeof record.review === "string" ? record.review.trim() : "";
  if (!rating || !body) return null;
  return {
    id:
      (typeof record.orderId === "string" && record.orderId) ||
      (typeof record.orderNumber === "string" && record.orderNumber) ||
      `${providerId}-${Math.random().toString(36).slice(2, 10)}`,
    providerId,
    customerName:
      typeof record.customerName === "string" && record.customerName.trim()
        ? record.customerName
        : "Customer",
    rating,
    body,
    serviceName: undefined,
    createdAt:
      typeof record.completedAt === "string" ? record.completedAt : new Date().toISOString(),
    isDemo: false,
  };
}

function normalizeActiveService(raw: unknown): PublicProfessional["activeServices"][number] | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id =
    (typeof record.id === "string" && record.id) ||
    (typeof record._id === "string" && record._id) ||
    "";
  const category = asRecord(record.category);
  const slug = typeof record.slug === "string" ? record.slug : "";
  if (!id && !slug) return null;
  return {
    id,
    servicesName: typeof record.servicesName === "string" ? record.servicesName : "",
    slug,
    price: toNumber(record.price, 0),
    unit: typeof record.unit === "string" ? record.unit : "",
    images: toStringArray(record.images),
    category: category
      ? {
          id:
            (typeof category.id === "string" && category.id) ||
            (typeof category._id === "string" && category._id) ||
            "",
          name: typeof category.name === "string" ? category.name : "",
          slug: typeof category.slug === "string" ? category.slug : "",
        }
      : null,
    commonServices: toStringArray(record.commonServices),
    workingArea: toStringArray(record.workingArea),
  };
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
  const profile = asRecord(record.profile) ?? {};
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
    description: typeof record.description === "string" ? record.description : "",
    phone: typeof record.phone === "string" ? record.phone : "",
    email: typeof record.email === "string" ? record.email : "",
    website: typeof record.website === "string" ? record.website : "",
    contactRole: typeof record.contactRole === "string" ? record.contactRole : "",
    avatarUrl: typeof record.avatarUrl === "string" ? record.avatarUrl : "",
    verificationBadge: {
      isVerified: Boolean(badge.isVerified),
      status: typeof badge.status === "string" ? badge.status : "",
      licensed: Boolean(badge.licensed),
      insured: Boolean(badge.insured),
    },
    profile: {
      yearsInBusiness: toNumber(profile.yearsInBusiness, 0),
      employeeCount: typeof profile.employeeCount === "string" ? profile.employeeCount : "",
      licensed: Boolean(profile.licensed),
      insured: Boolean(profile.insured),
    },
    tradeDetails: {
      primaryCategory: normalizePrimaryCategory(trade.primaryCategory),
      categoryIds: toStringArray(trade.categoryIds),
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
    workingHours: normalizeWorkingHours(record.workingHours),
    activeServices: (Array.isArray(record.activeServices) ? record.activeServices : [])
      .map(normalizeActiveService)
      .filter(
        (item): item is PublicProfessional["activeServices"][number] => Boolean(item),
      ),
    reviews: (Array.isArray(record.reviews) ? record.reviews : [])
      .map((item) => normalizeReview(item, id))
      .filter((item): item is Review => Boolean(item)),
    createdAt:
      typeof record.createdAt === "string" ? record.createdAt : undefined,
    updatedAt:
      typeof record.updatedAt === "string" ? record.updatedAt : undefined,
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

/** Detail payload: `{ success, data: Professional }` or bare professional object. */
function extractDetailEntity(response: unknown): PublicProfessional | null {
  const root = asRecord(response) ?? {};
  if (root.data != null && !Array.isArray(root.data)) {
    return normalizePublicProfessional(root.data);
  }
  return normalizePublicProfessional(response);
}

export function selectPublicProfessionalBySlug(
  state: { publicProfessionals?: PublicProfessionalsState },
  slug: string,
): PublicProfessional | null {
  const slice = state.publicProfessionals;
  if (!slice || !slug) return null;
  if (slice.detail?.slug === slug) return slice.detail;
  return slice.items.find((item) => item.slug === slug) ?? null;
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

type LiveLocationFields = {
  zip: string;
  city: string;
  state: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
};

/** Merge UI filters with live Redux location for a request (non-append). */
export function resolvePublicProfessionalsQuery(
  incoming: PublicProfessionalsQuery | undefined,
  location: LiveLocationFields,
): { query: PublicProfessionalsQuery; committed: boolean } {
  const hasZip = Boolean(location.zip.trim());
  const hasCoords =
    location.latitude != null &&
    Number.isFinite(location.latitude) &&
    location.longitude != null &&
    Number.isFinite(location.longitude);
  const committed =
    hasZip || hasCoords || Boolean(location.city.trim());

  const query: PublicProfessionalsQuery = {
    sortBy: "recommended",
    ...incoming,
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

  if (!query.zipCode?.trim()) delete query.zipCode;
  if (query.lat == null || !Number.isFinite(query.lat)) delete query.lat;
  if (query.lng == null || !Number.isFinite(query.lng)) delete query.lng;
  if (query.minRating == null || query.minRating <= 0) delete query.minRating;
  if (!query.locationToken) delete query.locationToken;

  return { query, committed };
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
  const categoryIds = professional.tradeDetails.categoryIds.length
    ? professional.tradeDetails.categoryIds
    : primary?.id
      ? [primary.id]
      : [];
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

  const tradeLabel =
    professional.tradeDetails.tradeTitle?.trim() ||
    professional.tagline?.trim() ||
    serviceLabels[0] ||
    "Home services";
  const city = professional.location.city.trim();
  const specialtyPreview = professional.tradeDetails.specialties
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
  const aboutParts = [
    city ? `${tradeLabel} for ${city} homes.` : `${tradeLabel}.`,
    specialtyPreview.length
      ? `Specialties include ${specialtyPreview.join(", ")}.`
      : "",
    professional.activeOfferings.startingPriceDisplay?.trim() || "",
  ].filter(Boolean);

  let yearsInBusiness = 0;
  let foundedYear = 0;
  if (professional.profile.yearsInBusiness > 0) {
    yearsInBusiness = professional.profile.yearsInBusiness;
    foundedYear = new Date().getFullYear() - professional.profile.yearsInBusiness;
  } else if (professional.createdAt) {
    const created = new Date(professional.createdAt);
    if (!Number.isNaN(created.getTime())) {
      foundedYear = created.getFullYear();
      const years = new Date().getFullYear() - foundedYear;
      yearsInBusiness = Math.max(0, years);
    }
  }

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
    description: professional.description || aboutParts.join(" "),
    rating: professional.performanceMetrics.rating.average,
    reviewCount: professional.performanceMetrics.rating.totalReviews,
    yearsInBusiness,
    licensed: professional.profile.licensed || professional.verificationBadge.licensed,
    insured: professional.profile.insured || professional.verificationBadge.insured,
    categoryIds,
    serviceLabels: serviceLabels.length ? serviceLabels : undefined,
    serviceArea: professional.location.coveredZipCodes,
    street: professional.location.address,
    city: professional.location.city,
    state: "",
    zip: professional.location.zip,
    lat,
    lng,
    phone: professional.phone,
    email: professional.email,
    website: professional.website || undefined,
    contact: professional.fullName.trim()
      ? {
          name: professional.fullName.trim(),
          role: professional.contactRole || "Business owner",
        }
      : undefined,
    workingHours: professional.workingHours,
    gallery: [],
    foundedYear,
    employeeCount: professional.profile.employeeCount,
    reviews: professional.reviews,
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

    const resolved = append
      ? null
      : resolvePublicProfessionalsQuery(incoming, location);
    const nextQuery: PublicProfessionalsQuery = append
      ? {
          ...state.query,
          ...incoming,
        }
      : resolved!.query;

    // Never call the directory without a committed location (selected place / geo).
    if (!append && !resolved!.committed) {
      return rejectWithValue("Location is required.");
    }

    // Reuse cached page when the exact query is already loaded (Landing ↔ Find a Pro).
    if (
      !append &&
      state.loaded &&
      state.items.length &&
      state.queryKey === buildPublicProfessionalsQueryKey(nextQuery)
    ) {
      return {
        items: state.items,
        page: state.page,
        limit: state.limit,
        total: state.total,
        totalPages: state.totalPages,
        hasNextPage: state.hasNextPage,
        append: false,
        query: nextQuery,
        queryKey: state.queryKey,
      };
    }

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
      if (state.loading) return false;
      const incoming =
        arg && typeof arg === "object" ? arg.query : undefined;
      const { query, committed } = resolvePublicProfessionalsQuery(
        incoming,
        location,
      );
      if (!committed) return false;
      const queryKey = buildPublicProfessionalsQueryKey(query);
      // Same data already in store — skip network (shared with Landing Page).
      if (state.loaded && state.items.length && state.queryKey === queryKey) {
        return false;
      }
      return true;
    },
  },
);

/**
 * Fallback for direct URL / refresh when listing state is unavailable.
 * Skips the network call when detail or list items already hold this slug.
 */
export const fetchPublicProfessionalBySlug = createAsyncThunk<
  PublicProfessional,
  string,
  {
    state: { publicProfessionals: PublicProfessionalsState };
    rejectValue: string;
  }
>(
  "publicProfessionals/fetchBySlug",
  async (slug, { rejectWithValue }) => {
    const trimmed = String(slug || "").trim();
    if (!trimmed) {
      return rejectWithValue("Professional slug is required.");
    }
    try {
      const response = await getData(
        publicApi.professional(trimmed),
        undefined,
        { silent: true },
      );
      const entity = extractDetailEntity(response);
      if (!entity) {
        return rejectWithValue("Professional not found.");
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
      const state = getState().publicProfessionals;
      if (state.detailLoading) return false;
      if (state.detail?.slug === trimmed) return false;
      return true;
    },
  },
);

const publicProfessionalsSlice = createSlice({
  name: "publicProfessionals",
  initialState,
  reducers: {
    /** Stash listing card data so the profile page can render without a fetch. */
    setPublicProfessionalDetail(
      state,
      action: PayloadAction<PublicProfessional>,
    ) {
      state.detail = action.payload;
      state.detailLoading = false;
      state.detailError = null;
    },
    clearPublicProfessionalDetail(state) {
      state.detail = null;
      state.detailLoading = false;
      state.detailError = null;
    },
    clearPublicProfessionalsError(state) {
      state.error = null;
      state.detailError = null;
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
      })
      .addCase(fetchPublicProfessionalBySlug.pending, (state) => {
        state.detailLoading = true;
        state.detailError = null;
      })
      .addCase(fetchPublicProfessionalBySlug.fulfilled, (state, action) => {
        state.detailLoading = false;
        state.detail = action.payload;
        state.detailError = null;
      })
      .addCase(fetchPublicProfessionalBySlug.rejected, (state, action) => {
        state.detailLoading = false;
        state.detailError =
          action.payload ||
          action.error.message ||
          "Failed to load professional.";
      });
  },
});

export const {
  setPublicProfessionalDetail,
  clearPublicProfessionalDetail,
  clearPublicProfessionalsError,
  resetPublicProfessionals,
} = publicProfessionalsSlice.actions;

export default publicProfessionalsSlice.reducer;
