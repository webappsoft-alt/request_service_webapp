import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { getData } from "@/components/api/sliceHttp";
import { publicApi } from "@/components/api/ApiRoutesFile";
import type { RootState } from "@/store";

export type PublicFaqItem = {
  id: string;
  question: string;
  answer: string;
  audience: "provider";
  domain?: string;
  sortOrder?: number;
};

type ProviderFaqsState = {
  items: PublicFaqItem[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

const initialState: ProviderFaqsState = {
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
    audience: "provider",
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

export const fetchProviderFaqs = createAsyncThunk<
  PublicFaqItem[],
  void,
  { state: RootState; rejectValue: string }
>(
  "providerFaqs/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const response = await getData(
        publicApi.faqs,
        { audience: "provider" },
        { silent: true, skipLogoutOn401: true, token: null },
      );
      return parseFaqsResponse(response);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState().providerFaqs;
      if (!state) return true;
      if (state.loading) return false;
      if (state.loaded && state.items.length > 0) return false;
      if (state.loaded) return false;
      return true;
    },
  },
);

const providerFaqsSlice = createSlice({
  name: "providerFaqs",
  initialState,
  reducers: {
    clearProviderFaqsError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProviderFaqs.pending, (state) => {
        if (state.items.length === 0) {
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchProviderFaqs.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.items = action.payload;
        state.error = null;
      })
      .addCase(fetchProviderFaqs.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to load FAQs.";
      });
  },
});

export const { clearProviderFaqsError } = providerFaqsSlice.actions;

export const selectProviderFaqs = (state: RootState) =>
  state.providerFaqs?.items ?? [];
export const selectProviderFaqsLoading = (state: RootState) =>
  Boolean(state.providerFaqs?.loading);
export const selectProviderFaqsLoaded = (state: RootState) =>
  Boolean(state.providerFaqs?.loaded);

export default providerFaqsSlice.reducer;
