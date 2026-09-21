import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { getData } from "@/components/api/sliceHttp";
import { userApi } from "@/components/api/ApiRoutesFile";
import type { RootState } from "@/store";

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
  createdAt?: string;
  updatedAt?: string;
  provider?: {
    id?: string;
    companyName?: string;
    slug?: string;
  } | null;
};

type CustomerQuotesState = {
  batches: CustomerQuoteBatch[];
  batchesLoading: boolean;
  batchesLoaded: boolean;
  batchesError: string | null;
  estimates: CustomerApiEstimate[];
  estimatesLoading: boolean;
  estimatesLoaded: boolean;
  estimatesError: string | null;
};

const initialState: CustomerQuotesState = {
  batches: [],
  batchesLoading: false,
  batchesLoaded: false,
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

export const fetchCustomerQuoteRequests = createAsyncThunk(
  "customerQuotes/fetchQuoteRequests",
  async (_, { rejectWithValue }) => {
    try {
      const response = await getData(userApi.quoteRequests);
      const root = asRecord(response);
      const data = asRecord(root?.data) ?? root;
      const batchesRaw = Array.isArray(data?.batches) ? data.batches : [];
      const batches: CustomerQuoteBatch[] = batchesRaw.map((item) => {
        const row = asRecord(item) ?? {};
        const professionalsRaw = Array.isArray(row.professionals)
          ? row.professionals
          : [];
        const rawPhotos = Array.isArray(row.photos)
          ? row.photos
          : Array.isArray(row.images)
            ? row.images
            : [];
        const photos = rawPhotos.filter((p): p is string => typeof p === "string" && Boolean(p.trim()));

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
                ).filter((x): x is string => typeof x === "string" && Boolean(x.trim()));

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
      return batches;
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
      const response = await getData(userApi.estimates);
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
        state.batches = action.payload;
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
export const selectCustomerApiEstimates = (state: RootState) =>
  state.customerQuotes?.estimates ?? [];
export const selectCustomerApiEstimatesLoading = (state: RootState) =>
  Boolean(state.customerQuotes?.estimatesLoading);

export default customerQuotesSlice.reducer;
