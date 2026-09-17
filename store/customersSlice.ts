import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/apiFuntions";
import { queryCustomers } from "@/lib/api/crm-client";
import type { PortalCustomerCrm } from "@/lib/data/crm-people";

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type CustomersState = {
  items: PortalCustomerCrm[];
  pagesCache: Record<string, PortalCustomerCrm[]>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  search: string;
  /** Active A–Z letter (`""` = All). Sent as the API `search` param when set. */
  letter: string;
  loading: boolean;
  error: string | null;
};

const DEFAULT_LIMIT = 10;

const initialState: CustomersState = {
  items: [],
  pagesCache: {},
  page: 1,
  limit: DEFAULT_LIMIT,
  total: 0,
  totalPages: 1,
  search: "",
  letter: "",
  loading: false,
  error: null,
};

export function customersPageCacheKey(
  search: string,
  letter: string,
  page: number,
  limit: number,
) {
  return `${letter.trim()}|${search.trim()}|${page}|${limit}`;
}

/** Letter filter takes priority; otherwise free-text search. */
export function customersApiSearch(search: string, letter: string) {
  const activeLetter = letter.trim();
  if (activeLetter) return activeLetter;
  return search.trim();
}

export type FetchCustomersArg = {
  page?: number;
  limit?: number;
  search?: string;
  letter?: string;
  /** Bypass pagesCache and always hit the API. */
  force?: boolean;
};

export const fetchCustomers = createAsyncThunk<
  {
    items: PortalCustomerCrm[];
    pagination: PaginationMeta;
    search: string;
    letter: string;
  },
  FetchCustomersArg | void,
  { state: { customers: CustomersState }; rejectValue: string }
>(
  "customers/fetchList",
  async (params, { getState, rejectWithValue }) => {
    const state = getState().customers;
    const page = params?.page ?? state.page;
    const limit = params?.limit ?? state.limit;
    const search = params?.search ?? state.search;
    const letter = params?.letter ?? state.letter;
    const apiSearch = customersApiSearch(search, letter);

    try {
      const result = await queryCustomers({
        page,
        limit,
        search: apiSearch || undefined,
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
        letter,
      };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (params, { getState }) => {
      if (params?.force) return true;
      const state = getState().customers;
      if (!state) return true;
      const page = params?.page ?? state.page;
      const limit = params?.limit ?? state.limit;
      const search = params?.search ?? state.search;
      const letter = params?.letter ?? state.letter;
      const key = customersPageCacheKey(search, letter, page, limit);
      // Navigate back / revisit: reuse cached page, skip the API call.
      if (key in state.pagesCache) {
        return false;
      }
      return true;
    },
  },
);

const customersSlice = createSlice({
  name: "customers",
  initialState,
  reducers: {
    setCustomersSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.letter = "";
      state.page = 1;
      state.pagesCache = {};
    },
    setCustomersLetter(state, action: PayloadAction<string>) {
      state.letter = action.payload;
      state.search = "";
      state.page = 1;
      state.pagesCache = {};
    },
    setCustomersPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
      const key = customersPageCacheKey(
        state.search,
        state.letter,
        state.page,
        state.limit,
      );
      if (key in state.pagesCache) {
        state.items = state.pagesCache[key];
      }
    },
    /** After create / edit / delete — drop cache so the next fetch hits the API. */
    invalidateCustomersCache(state) {
      state.pagesCache = {};
    },
    clearCustomersError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCustomers.pending, (state) => {
        // Keep existing rows visible on revisit; spinner only when empty.
        if (state.items.length === 0) state.loading = true;
        state.error = null;
      })
      .addCase(fetchCustomers.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.page = action.payload.pagination.page;
        // Keep our page size (10) — do not adopt whatever the API echoes back.
        state.limit = DEFAULT_LIMIT;
        state.total = action.payload.pagination.total;
        state.totalPages = Math.max(1, action.payload.pagination.totalPages);
        state.search = action.payload.search;
        state.letter = action.payload.letter;
        const key = customersPageCacheKey(
          state.search,
          state.letter,
          state.page,
          state.limit,
        );
        state.pagesCache[key] = action.payload.items;
      })
      .addCase(fetchCustomers.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to load customers.";
      });
  },
});

export const {
  setCustomersSearch,
  setCustomersLetter,
  setCustomersPage,
  invalidateCustomersCache,
  clearCustomersError,
} = customersSlice.actions;

export const selectCustomersShowLoader = (state: {
  customers?: CustomersState;
}) => {
  const slice = state.customers;
  if (!slice) return true;
  return slice.loading && slice.items.length === 0;
};

export default customersSlice.reducer;
