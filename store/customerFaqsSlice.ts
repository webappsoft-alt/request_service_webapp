import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { getData } from "@/components/api/sliceHttp";
import { publicApi } from "@/components/api/ApiRoutesFile";
import type { RootState } from "@/store";

export type PublicFaqItem = {
  id: string;
  question: string;
  answer: string;
  audience: "customer";
  domain?: string;
  sortOrder?: number;
};

type CustomerFaqsState = {
  items: PublicFaqItem[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

const initialState: CustomerFaqsState = {
  items: [],
  loading: false,
  loaded: false,
  error: null,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeFaq(raw: unknown): PublicFaqItem | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id =
    (typeof record.id === "string" && record.id) ||
    (typeof record._id === "string" && record._id) ||
    "";
  const question =
    typeof record.question === "string" ? record.question.trim() : "";
  const answer = typeof record.answer === "string" ? record.answer.trim() : "";
  if (!id || !question || !answer) return null;
  return {
    id,
    question,
    answer,
    audience: "customer",
    domain: typeof record.domain === "string" ? record.domain : undefined,
    sortOrder:
      typeof record.sortOrder === "number" ? record.sortOrder : undefined,
  };
}

function parseFaqsResponse(response: unknown): PublicFaqItem[] {
  const list = Array.isArray(response)
    ? response
    : Array.isArray(asRecord(response)?.data)
      ? (asRecord(response)?.data as unknown[])
      : [];
  return list
    .map(normalizeFaq)
    .filter((item): item is PublicFaqItem => Boolean(item));
}

export const fetchCustomerFaqs = createAsyncThunk<
  PublicFaqItem[],
  void,
  { state: RootState; rejectValue: string }
>(
  "customerFaqs/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const response = await getData(
        publicApi.faqs,
        { audience: "customer" },
        { silent: true, skipLogoutOn401: true, token: null },
      );
      return parseFaqsResponse(response);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState().customerFaqs;
      if (!state) return true;
      if (state.loading) return false;
      // Cache hit: data already in slice — skip network and loading.
      if (state.loaded && state.items.length > 0) return false;
      // Also skip if we already fetched successfully (even empty).
      if (state.loaded) return false;
      return true;
    },
  },
);

const customerFaqsSlice = createSlice({
  name: "customerFaqs",
  initialState,
  reducers: {
    clearCustomerFaqsError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCustomerFaqs.pending, (state) => {
        // Only show loading when we do not already have cached FAQs.
        if (state.items.length === 0) {
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchCustomerFaqs.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.items = action.payload;
        state.error = null;
      })
      .addCase(fetchCustomerFaqs.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to load FAQs.";
      });
  },
});

export const { clearCustomerFaqsError } = customerFaqsSlice.actions;

export const selectCustomerFaqs = (state: RootState) =>
  state.customerFaqs?.items ?? [];
export const selectCustomerFaqsLoading = (state: RootState) =>
  Boolean(state.customerFaqs?.loading);
export const selectCustomerFaqsLoaded = (state: RootState) =>
  Boolean(state.customerFaqs?.loaded);

export default customerFaqsSlice.reducer;
