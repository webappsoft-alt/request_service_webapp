import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/apiFuntions";
import {
  createContractor,
  deleteContractor,
  queryContractors,
  updateContractor,
} from "@/lib/api/crm-client";
import type { PortalContractor } from "@/lib/data/crm-people";

/** List page size for GET /provider/contractors */
export const CONTRACTORS_DEFAULT_LIMIT = 10;

type ContractorsState = {
  items: PortalContractor[];
  pagesCache: Record<string, PortalContractor[]>;
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

const initialState: ContractorsState = {
  items: [],
  pagesCache: {},
  page: 1,
  limit: CONTRACTORS_DEFAULT_LIMIT,
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

export const fetchContractors = createAsyncThunk<
  {
    items: PortalContractor[];
    page: number;
    total: number;
    totalPages: number;
    search: string;
    status: string;
  },
  void,
  { state: { contractors: ContractorsState }; rejectValue: string }
>("contractors/fetchList", async (_params, { getState, rejectWithValue }) => {
  const state = getState().contractors ?? initialState;
  try {
    const result = await queryContractors({
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

export const createContractorRecord = createAsyncThunk<
  PortalContractor,
  PortalContractor,
  { rejectValue: string }
>("contractors/create", async (payload, { rejectWithValue }) => {
  try {
    const created = await createContractor(payload);
    if (!created) return rejectWithValue("Contractor was created but could not be read.");
    return created;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const updateContractorRecord = createAsyncThunk<
  PortalContractor,
  { id: string; patch: Partial<PortalContractor> },
  { rejectValue: string }
>("contractors/update", async ({ id, patch }, { rejectWithValue }) => {
  try {
    const updated = await updateContractor(id, patch);
    if (!updated) return rejectWithValue("Contractor was updated but could not be read.");
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const deleteContractorRecord = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>("contractors/delete", async (id, { rejectWithValue }) => {
  try {
    await deleteContractor(id);
    return id;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

const contractorsSlice = createSlice({
  name: "contractors",
  initialState,
  reducers: {
    setContractorsSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    setContractorsPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
      const key = cacheKey(state.search, state.status, state.page, state.limit);
      if (key in state.pagesCache) state.items = state.pagesCache[key];
    },
    setContractorsStatus(state, action: PayloadAction<string>) {
      state.status = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    invalidateContractorsCache(state) {
      state.pagesCache = {};
    },
    clearContractorsError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchContractors.pending, (state) => {
        if (state.items.length === 0) state.loading = true;
        state.error = null;
      })
      .addCase(fetchContractors.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.page = action.payload.page;
        state.limit = CONTRACTORS_DEFAULT_LIMIT;
        state.total = action.payload.total;
        state.totalPages = Math.max(1, action.payload.totalPages);
        state.search = action.payload.search;
        state.status = action.payload.status;
        state.pagesCache[
          cacheKey(state.search, state.status, state.page, state.limit)
        ] = action.payload.items;
      })
      .addCase(fetchContractors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to load contractors.";
      })
      .addCase(createContractorRecord.pending, (state) => {
        state.mutating = true;
      })
      .addCase(createContractorRecord.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        state.page = 1;
        state.items = [
          action.payload,
          ...state.items.filter((item) => item.id !== action.payload.id),
        ];
        state.total += 1;
      })
      .addCase(createContractorRecord.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload || "Failed to create contractor.";
      })
      .addCase(updateContractorRecord.fulfilled, (state, action) => {
        const updated = action.payload;
        state.items = state.items.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        );
      })
      .addCase(deleteContractorRecord.fulfilled, (state, action) => {
        state.pagesCache = {};
        state.items = state.items.filter((item) => item.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
      });
  },
});

export const {
  setContractorsSearch,
  setContractorsPage,
  setContractorsStatus,
  invalidateContractorsCache,
  clearContractorsError,
} = contractorsSlice.actions;

export default contractorsSlice.reducer;
