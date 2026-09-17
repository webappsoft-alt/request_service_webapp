import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/apiFuntions";
import {
  createVendor,
  deleteVendor,
  queryVendors,
  updateVendor,
} from "@/lib/api/crm-client";
import type { PortalVendor } from "@/lib/data/crm-people";

/** List page size for GET /provider/vendors */
export const VENDORS_DEFAULT_LIMIT = 10;

type VendorsState = {
  items: PortalVendor[];
  pagesCache: Record<string, PortalVendor[]>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  search: string;
  status: string;
  loading: boolean;
  mutating: boolean;
  error: string | null;
};

const initialState: VendorsState = {
  items: [],
  pagesCache: {},
  page: 1,
  limit: VENDORS_DEFAULT_LIMIT,
  total: 0,
  totalPages: 1,
  search: "",
  status: "",
  loading: false,
  mutating: false,
  error: null,
};

function cacheKey(search: string, status: string, page: number, limit: number) {
  return `${status}|${search.trim()}|${page}|${limit}`;
}

export const fetchVendors = createAsyncThunk<
  {
    items: PortalVendor[];
    page: number;
    total: number;
    totalPages: number;
    search: string;
    status: string;
  },
  void,
  { state: { vendors: VendorsState }; rejectValue: string }
>("vendors/fetchList", async (_params, { getState, rejectWithValue }) => {
  const state = getState().vendors ?? initialState;
  try {
    const result = await queryVendors({
      page: state.page,
      limit: state.limit,
      search: state.search.trim() || undefined,
      status: state.status.trim() || undefined,
      force: true,
      silent: true,
    });
    return {
      items: result.items,
      page: result.page,
      total: result.total,
      totalPages: result.totalPages,
      search: state.search,
      status: state.status,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const createVendorRecord = createAsyncThunk<
  PortalVendor,
  PortalVendor,
  { rejectValue: string }
>("vendors/create", async (payload, { rejectWithValue }) => {
  try {
    const created = await createVendor(payload);
    if (!created) return rejectWithValue("Vendor was created but could not be read.");
    return created;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const updateVendorRecord = createAsyncThunk<
  PortalVendor,
  { id: string; patch: Partial<PortalVendor> },
  { rejectValue: string }
>("vendors/update", async ({ id, patch }, { rejectWithValue }) => {
  try {
    const updated = await updateVendor(id, patch);
    if (!updated) return rejectWithValue("Vendor was updated but could not be read.");
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const deleteVendorRecord = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>("vendors/delete", async (id, { rejectWithValue }) => {
  try {
    await deleteVendor(id);
    return id;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

const vendorsSlice = createSlice({
  name: "vendors",
  initialState,
  reducers: {
    setVendorsSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    setVendorsPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
      const key = cacheKey(state.search, state.status, state.page, state.limit);
      if (key in state.pagesCache) state.items = state.pagesCache[key];
    },
    setVendorsStatus(state, action: PayloadAction<string>) {
      state.status = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    invalidateVendorsCache(state) {
      state.pagesCache = {};
    },
    clearVendorsError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVendors.pending, (state) => {
        if (state.items.length === 0) state.loading = true;
        state.error = null;
      })
      .addCase(fetchVendors.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.page = action.payload.page;
        state.limit = VENDORS_DEFAULT_LIMIT;
        state.total = action.payload.total;
        state.totalPages = Math.max(1, action.payload.totalPages);
        state.search = action.payload.search;
        state.status = action.payload.status;
        state.pagesCache[
          cacheKey(state.search, state.status, state.page, state.limit)
        ] = action.payload.items;
      })
      .addCase(fetchVendors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to load vendors.";
      })
      .addCase(createVendorRecord.pending, (state) => {
        state.mutating = true;
      })
      .addCase(createVendorRecord.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        state.page = 1;
        state.items = [
          action.payload,
          ...state.items.filter((item) => item.id !== action.payload.id),
        ];
        state.total += 1;
      })
      .addCase(createVendorRecord.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload || "Failed to create vendor.";
      })
      .addCase(updateVendorRecord.fulfilled, (state, action) => {
        const updated = action.payload;
        state.items = state.items.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        );
      })
      .addCase(deleteVendorRecord.fulfilled, (state, action) => {
        state.pagesCache = {};
        state.items = state.items.filter((item) => item.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
      });
  },
});

export const {
  setVendorsSearch,
  setVendorsPage,
  setVendorsStatus,
  invalidateVendorsCache,
  clearVendorsError,
} = vendorsSlice.actions;

export default vendorsSlice.reducer;
