import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { getData } from "@/components/api/sliceHttp";
import { userApi } from "@/components/api/ApiRoutesFile";
import type { RootState } from "@/store";

export const CUSTOMER_QUOTE_REQUESTS_PAGE_LIMIT = 10;

export type CustomerQuoteProfessional = {
  requestId: string;
  number: string;
  providerId: string;
  providerName: string;
  providerSlug: string;
  status: string;
  seen: boolean;
  firstViewedAt: string | null;
  photos?: string[];
  images?: string[];
  estimates: Array<{
    id: string;
    number: string;
    title?: string;
    status: string;
    shareToken: string;
    total: number;
    createdAt?: string;
    photos?: string[];
    images?: string[];
    siteVisit?: unknown;
  }>;
};

export type CustomerQuoteBatch = {
  quoteBatchId: string | null;
  serviceName: string;
  zip: string;
  street: string;
  city: string;
  state: string;
  channel: string;
  createdAt: string;
  details: string;
  answers?: Array<{ id?: string; label?: string; value?: string }>;
  photos?: string[];
  images?: string[];
  sentToCount: number;
  seenCount: number;
  estimateCount: number;
  professionals: CustomerQuoteProfessional[];
};

export type CustomerApiEstimate = {
  id: string;
  number: string;
  title: string;
  status: string;
  total: number;
  shareToken: string;
  requestId: string | null;
  jobId: string | null;
  jobNumber?: string | null;
  createdAt?: string;
  updatedAt?: string;
  provider?: {
    id?: string;
    companyName?: string;
    slug?: string;
  } | null;
};

export type CustomerQuoteRequestsPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

type CustomerQuotesState = {
  batches: CustomerQuoteBatch[];
  batchesPagination: CustomerQuoteRequestsPagination | null;
  batchesLoading: boolean;
  batchesLoaded: boolean;
  /** Query (page/limit/search) of the rows currently in `batches`. */
  batchesLoadedKey: string | null;
  batchesError: string | null;
  estimates: CustomerApiEstimate[];
  estimatesLoading: boolean;
  estimatesLoaded: boolean;
  estimatesError: string | null;
};

const initialPagination = (): CustomerQuoteRequestsPagination => ({
  page: 1,
  limit: CUSTOMER_QUOTE_REQUESTS_PAGE_LIMIT,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
});

const initialState: CustomerQuotesState = {
  batches: [],
  batchesPagination: null,
  batchesLoading: false,
  batchesLoaded: false,
  batchesLoadedKey: null,
  batchesError: null,
  estimates: [],
  estimatesLoading: false,
  estimatesLoaded: false,
  estimatesError: null,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function numberValue(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parseBatches(raw: unknown[]): CustomerQuoteBatch[] {
  return raw.map((item) => {
    const row = asRecord(item) ?? {};
    const professionalsRaw = Array.isArray(row.professionals)
      ? row.professionals
      : [];
    const rawPhotos = Array.isArray(row.photos)
      ? row.photos
      : Array.isArray(row.images)
        ? row.images
        : [];
    const photos = rawPhotos.filter(
      (p): p is string => typeof p === "string" && Boolean(p.trim()),
    );

    return {
      quoteBatchId: stringValue(row.quoteBatchId) || null,
      serviceName: stringValue(row.serviceName) || "Service request",
      zip: stringValue(row.zip),
      street: stringValue(row.street),
      city: stringValue(row.city),
      state: stringValue(row.state),
      channel: stringValue(row.channel),
      createdAt: stringValue(row.createdAt),
      details: stringValue(row.details),
      answers: Array.isArray(row.answers)
        ? row.answers.map((a) => {
            const ans = asRecord(a) ?? {};
            return {
              id: stringValue(ans.id),
              label: stringValue(ans.label),
              value: stringValue(ans.value),
            };
          })
        : [],
      photos,
      images: photos,
      sentToCount: numberValue(row.sentToCount),
      seenCount: numberValue(row.seenCount),
      estimateCount: numberValue(row.estimateCount),
      professionals: professionalsRaw.map((pro) => {
        const p = asRecord(pro) ?? {};
        const estimatesRaw = Array.isArray(p.estimates) ? p.estimates : [];
        const proPhotos = (
          Array.isArray(p.photos)
            ? p.photos
            : Array.isArray(p.images)
              ? p.images
              : []
        ).filter((x): x is string => typeof x === "string" && Boolean(x.trim()));

        return {
          requestId: stringValue(p.requestId),
          number: stringValue(p.number),
          providerId: stringValue(p.providerId),
          providerName: stringValue(p.providerName) || "Professional",
          providerSlug: stringValue(p.providerSlug),
          status: stringValue(p.status) || "new",
          seen: Boolean(p.seen),
          firstViewedAt: stringValue(p.firstViewedAt) || null,
          photos: proPhotos,
          images: proPhotos,
          estimates: estimatesRaw.map((est) => {
            const e = asRecord(est) ?? {};
            const estPhotos = (
              Array.isArray(e.photos)
                ? e.photos
                : Array.isArray(e.images)
                  ? e.images
                  : []
            ).filter(
              (x): x is string => typeof x === "string" && Boolean(x.trim()),
            );

            return {
              id: stringValue(e.id),
              number: stringValue(e.number),
              title: stringValue(e.title),
              status: stringValue(e.status),
              shareToken: stringValue(e.shareToken),
              total: numberValue(e.total),
              createdAt: stringValue(e.createdAt) || undefined,
              photos: estPhotos,
              images: estPhotos,
              siteVisit: e.siteVisit || undefined,
            };
          }),
        };
      }),
    };
  });
}

function parsePagination(
  raw: unknown,
  fallbackCount: number,
  page: number,
  limit: number,
): CustomerQuoteRequestsPagination {
  const pagination = asRecord(raw) ?? {};
  const resolvedPage = Math.max(
    1,
    numberValue(pagination.page ?? pagination.currentPage, page),
  );
  const resolvedLimit = Math.max(
    1,
    numberValue(pagination.limit, limit || CUSTOMER_QUOTE_REQUESTS_PAGE_LIMIT),
  );
  const total = Math.max(
    0,
    numberValue(
      pagination.total ?? pagination.totalRecords ?? fallbackCount,
      fallbackCount,
    ),
  );
  let totalPages = Math.max(1, numberValue(pagination.totalPages, 0));
  if (!pagination.totalPages) {
    totalPages = Math.max(1, Math.ceil(total / resolvedLimit) || 1);
  }
  const hasNextPage =
    typeof pagination.hasNextPage === "boolean"
      ? pagination.hasNextPage
      : resolvedPage < totalPages;
  const hasPrevPage =
    typeof pagination.hasPrevPage === "boolean"
      ? pagination.hasPrevPage
      : resolvedPage > 1;
  return {
    page: resolvedPage,
    limit: resolvedLimit,
    total,
    totalPages,
    hasNextPage,
    hasPrevPage,
  };
}

export function quoteRequestsKey(
  arg?: { page?: number; limit?: number; search?: string } | void,
) {
  const value = arg || {};
  return JSON.stringify({
    page: Math.max(1, Number(value.page) || 1),
    limit: Number(value.limit) || CUSTOMER_QUOTE_REQUESTS_PAGE_LIMIT,
    search: String(value.search || "").trim(),
  });
}

/** Spinner only when the table would show a different page/search. */
export const selectCustomerQuoteRequestsTableLoading =
  (arg: { page?: number; limit?: number; search?: string }) =>
  (state: RootState) =>
    Boolean(state.customerQuotes?.batchesLoading) &&
    (!(state.customerQuotes?.batches.length) ||
      state.customerQuotes?.batchesLoadedKey !== quoteRequestsKey(arg));

export const fetchCustomerQuoteRequests = createAsyncThunk(
  "customerQuotes/fetchQuoteRequests",
  async (
    arg:
      | {
          page?: number;
          limit?: number;
          search?: string;
          force?: boolean;
        }
      | undefined,
    { rejectWithValue },
  ) => {
    const page = Math.max(1, Number(arg?.page) || 1);
    const limit = Math.max(
      1,
      Number(arg?.limit) || CUSTOMER_QUOTE_REQUESTS_PAGE_LIMIT,
    );
    const search = String(arg?.search || "").trim() || undefined;
    try {
      const response = await getData(
        userApi.quoteRequests,
        { page, limit, search },
        { force: Boolean(arg?.force), silent: true },
      );
      const root = asRecord(response);
      const data = asRecord(root?.data) ?? root;
      const batchesRaw = Array.isArray(data?.batches) ? data.batches : [];
      const batches = parseBatches(batchesRaw);
      const pagination = parsePagination(
        data?.pagination ?? root?.pagination,
        numberValue(data?.count, batches.length),
        page,
        limit,
      );
      return { batches, pagination };
    } catch (err) {
      return rejectWithValue(
        extractErrorMessage(err) || "Could not load quote requests.",
      );
    }
  },
);

export const fetchCustomerEstimates = createAsyncThunk(
  "customerQuotes/fetchEstimates",
  async (_, { rejectWithValue }) => {
    try {
      // force: bypass the 45s GET cache so every tab visit refreshes in the background.
      const response = await getData(userApi.estimates, undefined, { force: true, silent: true });
      const root = asRecord(response);
      const data = asRecord(root?.data) ?? root;
      const listRaw = Array.isArray(data?.estimates) ? data.estimates : [];
      const estimates: CustomerApiEstimate[] = listRaw.map((item) => {
        const row = asRecord(item) ?? {};
        const provider = asRecord(row.provider);
        return {
          id: stringValue(row.id),
          number: stringValue(row.number),
          title: stringValue(row.title) || stringValue(row.number) || "Estimate",
          status: stringValue(row.status) || "sent",
          total: numberValue(row.total),
          shareToken: stringValue(row.shareToken),
          requestId: stringValue(row.requestId) || null,
          jobId: stringValue(row.jobId) || null,
          jobNumber: stringValue(row.jobNumber) || null,
          createdAt: stringValue(row.createdAt) || undefined,
          updatedAt: stringValue(row.updatedAt) || undefined,
          provider: provider
            ? {
                id: stringValue(provider.id),
                companyName: stringValue(provider.companyName),
                slug: stringValue(provider.slug),
              }
            : null,
        };
      });
      return estimates;
    } catch (err) {
      return rejectWithValue(
        extractErrorMessage(err) || "Could not load estimates.",
      );
    }
  },
);

const customerQuotesSlice = createSlice({
  name: "customerQuotes",
  initialState,
  reducers: {
    clearCustomerQuotes(state) {
      Object.assign(state, initialState);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCustomerQuoteRequests.pending, (state) => {
        state.batchesLoading = true;
        state.batchesError = null;
      })
      .addCase(fetchCustomerQuoteRequests.fulfilled, (state, action) => {
        state.batchesLoading = false;
        state.batchesLoaded = true;
        state.batches = action.payload.batches;
        state.batchesPagination =
          action.payload.pagination || initialPagination();
        state.batchesLoadedKey = quoteRequestsKey(action.meta.arg);
      })
      .addCase(fetchCustomerQuoteRequests.rejected, (state, action) => {
        state.batchesLoading = false;
        state.batchesLoaded = true;
        state.batchesError =
          typeof action.payload === "string"
            ? action.payload
            : "Could not load quote requests.";
      })
      .addCase(fetchCustomerEstimates.pending, (state) => {
        state.estimatesLoading = true;
        state.estimatesError = null;
      })
      .addCase(fetchCustomerEstimates.fulfilled, (state, action) => {
        state.estimatesLoading = false;
        state.estimatesLoaded = true;
        state.estimates = action.payload;
      })
      .addCase(fetchCustomerEstimates.rejected, (state, action) => {
        state.estimatesLoading = false;
        state.estimatesLoaded = true;
        state.estimatesError =
          typeof action.payload === "string"
            ? action.payload
            : "Could not load estimates.";
      });
  },
});

export const { clearCustomerQuotes } = customerQuotesSlice.actions;

export const selectCustomerQuoteBatches = (state: RootState) =>
  state.customerQuotes?.batches ?? [];
export const selectCustomerQuoteBatchesLoading = (state: RootState) =>
  Boolean(state.customerQuotes?.batchesLoading);
export const selectCustomerQuoteBatchesPagination = (state: RootState) =>
  state.customerQuotes?.batchesPagination ?? initialPagination();
export const selectCustomerApiEstimates = (state: RootState) =>
  state.customerQuotes?.estimates ?? [];
export const selectCustomerApiEstimatesLoading = (state: RootState) =>
  Boolean(state.customerQuotes?.estimatesLoading);

export default customerQuotesSlice.reducer;
