import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { queryEstimates } from "@/lib/api/crm-client";
import type { Estimate } from "@/lib/types";

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type EstimatesState = {
  items: Estimate[];
  pagesCache: Record<string, Estimate[]>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  search: string;
  /** Active status filter (`""` = All). Sent as the API `status` param when set. */
  status: string;
  customerId?: string;
  loading: boolean;
  error: string | null;
};

const DEFAULT_LIMIT = 10;

const initialState: EstimatesState = {
  items: [],
  pagesCache: {},
  page: 1,
  limit: DEFAULT_LIMIT,
  total: 0,
  totalPages: 1,
  search: "",
  status: "",
  customerId: undefined,
  loading: false,
  error: null,
};

export function estimatesPageCacheKey(
  search: string,
  status: string,
  customerId: string | undefined,
  page: number,
  limit: number,
) {
  return `${customerId || ""}|${status.trim()}|${search.trim()}|${page}|${limit}`;
}

export type FetchEstimatesArg = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  customerId?: string;
  /** Bypass pagesCache and always hit the API. */
  force?: boolean;
};

export const fetchEstimates = createAsyncThunk<
  {
    items: Estimate[];
    pagination: PaginationMeta;
    search: string;
    status: string;
    customerId?: string;
  },
  FetchEstimatesArg | void,
  { state: { estimates: EstimatesState }; rejectValue: string }
>(
  "estimates/fetchList",
  async (params, { getState, rejectWithValue }) => {
    const state = getState().estimates;
    const page = params?.page ?? state.page;
    const limit = params?.limit ?? state.limit;
    const search = params?.search ?? state.search;
    const status = params?.status !== undefined ? params.status : state.status;
    const customerId = params?.customerId !== undefined ? params.customerId : state.customerId;

    try {
      const result = await queryEstimates({
        page,
        limit,
        search: search.trim() || undefined,
        status: status.trim() && status.trim() !== "archived" ? status.trim() : undefined,
        customerId: customerId?.trim() || undefined,
        silent: true,
        force: true,
      });
      return {
        items: result.items,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
        search,
        status,
        customerId,
      };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (params, { getState }) => {
      if (params?.force) return true;
      const state = getState().estimates;
      if (!state) return true;
      const page = params?.page ?? state.page;
      const limit = params?.limit ?? state.limit;
      const search = params?.search ?? state.search;
      const status = params?.status !== undefined ? params.status : state.status;
      const customerId = params?.customerId !== undefined ? params.customerId : state.customerId;
      const key = estimatesPageCacheKey(search, status, customerId, page, limit);
      if (key in state.pagesCache) {
        return false;
      }
      return true;
    },
  },
);

const estimatesSlice = createSlice({
  name: "estimates",
  initialState,
  reducers: {
    setEstimatesSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    setEstimatesStatus(state, action: PayloadAction<string>) {
      state.status = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    setEstimatesCustomerId(state, action: PayloadAction<string | undefined>) {
      state.customerId = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    setEstimatesPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
      const key = estimatesPageCacheKey(
        state.search,
        state.status,
        state.customerId,
        state.page,
        state.limit,
      );
      if (key in state.pagesCache) {
        state.items = state.pagesCache[key];
      }
    },
    patchEstimateLocally(
      state,
      action: PayloadAction<{ id: string; patch: Partial<Estimate> }>,
    ) {
      const { id, patch } = action.payload;
      state.items = state.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      );
      // Clear cache so fresh data is fetched on subsequent pagination/filters
      state.pagesCache = {};
    },
    removeEstimateLocally(state, action: PayloadAction<string>) {
      const id = action.payload;
      state.items = state.items.filter((item) => item.id !== id);
      state.total = Math.max(0, state.total - 1);
      state.pagesCache = {};
    },
    /** After create / edit / delete / status update — drop cache so the next fetch hits the API. */
    invalidateEstimatesCache(state) {
      state.pagesCache = {};
    },
    clearEstimatesError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEstimates.pending, (state) => {
        if (state.items.length === 0) state.loading = true;
        state.error = null;
      })
      .addCase(fetchEstimates.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.page = action.payload.pagination.page;
        state.limit = DEFAULT_LIMIT;
        state.total = action.payload.pagination.total;
        state.totalPages = Math.max(1, action.payload.pagination.totalPages);
        state.search = action.payload.search;
        state.status = action.payload.status;
        state.customerId = action.payload.customerId;
        const key = estimatesPageCacheKey(
          state.search,
          state.status,
          state.customerId,
          state.page,
          state.limit,
        );
        state.pagesCache[key] = action.payload.items;
      })
      .addCase(fetchEstimates.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to load estimates.";
      });
  },
});

export const {
  setEstimatesSearch,
  setEstimatesStatus,
  setEstimatesCustomerId,
  setEstimatesPage,
  patchEstimateLocally,
  removeEstimateLocally,
  invalidateEstimatesCache,
  clearEstimatesError,
} = estimatesSlice.actions;

export const selectEstimatesShowLoader = (state: {
  estimates?: EstimatesState;
}) => {
  const slice = state.estimates;
  if (!slice) return true;
  return slice.loading && slice.items.length === 0;
};

export default estimatesSlice.reducer;
