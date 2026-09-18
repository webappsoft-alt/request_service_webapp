import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import {
  createContractor,
  deleteContractor,
  getContractor,
  queryContractors,
  queryEstimates,
  queryJobs,
  querySchedule,
  updateContractor,
} from "@/lib/api/crm-client";
import type { PortalContractor } from "@/lib/data/crm-people";
import type { PortalCalendarEvent, PortalEmployeeWorkingHours } from "@/lib/data/portal";
import type { Estimate, Job } from "@/lib/types";

/** List page size for GET /provider/contractors */
export const CONTRACTORS_DEFAULT_LIMIT = 10;
const DETAIL_TAB_LIMIT = 10;

type TabListState<T> = {
  contractorId: string;
  filterKey: string;
  items: T[];
  /** True after a successful GET for this contractorId + filterKey (including empty lists). */
  loaded: boolean;
  loading: boolean;
  error: string | null;
  page: number;
  total: number;
  totalPages: number;
};

function emptyTabList<T>(): TabListState<T> {
  return {
    contractorId: "",
    filterKey: "",
    items: [],
    loaded: false,
    loading: false,
    error: null,
    page: 1,
    total: 0,
    totalPages: 1,
  };
}

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
  detail: PortalContractor | null;
  detailLoading: boolean;
  detailError: string | null;
  /** Session-only working hours until contractor API supports workingHours. */
  availabilityById: Record<string, PortalEmployeeWorkingHours[]>;
  jobs: TabListState<Job>;
  estimates: TabListState<Estimate>;
  schedule: TabListState<PortalCalendarEvent>;
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
  detail: null,
  detailLoading: false,
  detailError: null,
  availabilityById: {},
  jobs: emptyTabList(),
  estimates: emptyTabList(),
  schedule: emptyTabList(),
};

function cacheKey(search: string, status: string, page: number, limit: number) {
  return `${status}|${search.trim()}|${page}|${limit}`;
}

function tabCacheKey(arg: { status?: string; search?: string; page?: number; kind?: string }) {
  return `${arg.status?.trim() || ""}|${arg.search?.trim() || ""}|${arg.kind?.trim() || ""}|${arg.page ?? 1}`;
}

export function contractorsTabFilterKey(arg: {
  status?: string;
  search?: string;
  page?: number;
  kind?: string;
}) {
  return tabCacheKey(arg);
}

export function selectContractorsTabShowLoader<T>(
  tab: TabListState<T> | null | undefined,
  contractorId: string,
  filterKey = "|||1",
) {
  if (!contractorId) return false;
  if (!tab) return true;
  const sameView = tab.contractorId === contractorId && tab.filterKey === filterKey;
  if (!sameView) return true;
  return Boolean(tab.loading && tab.items.length === 0);
}

/** Prefer Redux tab rows whenever they belong to this contractor (including empty loaded lists). */
export function selectContractorsTabRows<T>(
  tab: TabListState<T> | null | undefined,
  contractorId: string,
  filterKey = "|||1",
  fallback: T[] = [],
): T[] {
  if (!tab || tab.contractorId !== contractorId) return fallback;
  if (tab.loaded && tab.filterKey === filterKey) return tab.items;
  if (tab.loading || tab.items.length > 0) return tab.items;
  return fallback;
}

function setTabPending<T>(tab: TabListState<T>, contractorId: string, filterKey: string) {
  const sameView = tab.contractorId === contractorId && tab.filterKey === filterKey;
  if (!sameView) {
    tab.items = [];
    tab.loaded = false;
  }
  if (tab.items.length === 0) {
    tab.loading = true;
  }
  tab.error = null;
  tab.contractorId = contractorId;
  tab.filterKey = filterKey;
}

function setTabFulfilled<T>(
  tab: TabListState<T>,
  payload: {
    contractorId: string;
    filterKey: string;
    items: T[];
    page?: number;
    total?: number;
    totalPages?: number;
  },
) {
  tab.loading = false;
  tab.loaded = true;
  tab.error = null;
  tab.contractorId = payload.contractorId;
  tab.filterKey = payload.filterKey;
  tab.items = payload.items;
  tab.page = payload.page ?? 1;
  tab.total = payload.total ?? payload.items.length;
  tab.totalPages = payload.totalPages ?? 1;
}

function setTabRejected<T>(tab: TabListState<T>, message: string) {
  tab.loading = false;
  tab.error = message;
}

type ContractorTabArg = {
  contractorId: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  force?: boolean;
  kind?: string;
};

function applyDetail(state: ContractorsState, contractor: PortalContractor) {
  const cached =
    state.items.find((item) => item.id === contractor.id) ??
    (state.detail?.id === contractor.id ? state.detail : null);
  const merged: PortalContractor = cached ? { ...cached, ...contractor } : contractor;
  state.detail = merged;
  state.detailLoading = false;
  state.detailError = null;
  state.items = state.items.map((item) =>
    item.id === merged.id ? { ...item, ...merged } : item,
  );
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

export const fetchContractorDetail = createAsyncThunk<
  PortalContractor,
  string,
  { rejectValue: string }
>("contractors/fetchDetail", async (id, { rejectWithValue }) => {
  try {
    const detail = await getContractor(id);
    if (!detail) return rejectWithValue("Contractor not found.");
    return detail;
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
    if (updated) return updated;
    const detail = await getContractor(id);
    if (!detail) return rejectWithValue("Contractor was updated but could not be read.");
    return detail;
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

export const fetchContractorJobs = createAsyncThunk<
  {
    contractorId: string;
    filterKey: string;
    items: Job[];
    page: number;
    total: number;
    totalPages: number;
  },
  ContractorTabArg,
  { state: { contractors: ContractorsState }; rejectValue: string }
>("contractors/fetchJobs", async (arg, { rejectWithValue }) => {
  const filterKey = tabCacheKey(arg);
  try {
    const result = await queryJobs({
      contractorId: arg.contractorId,
      status: arg.status || undefined,
      search: arg.search || undefined,
      page: arg.page ?? 1,
      limit: arg.limit ?? DETAIL_TAB_LIMIT,
      force: true,
      silent: true,
    });
    return {
      contractorId: arg.contractorId,
      filterKey,
      items: result.items,
      page: result.page,
      total: result.total,
      totalPages: result.totalPages,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchContractorEstimates = createAsyncThunk<
  {
    contractorId: string;
    filterKey: string;
    items: Estimate[];
    page: number;
    total: number;
    totalPages: number;
  },
  ContractorTabArg,
  { state: { contractors: ContractorsState }; rejectValue: string }
>("contractors/fetchEstimates", async (arg, { rejectWithValue }) => {
  const filterKey = tabCacheKey(arg);
  try {
    // Manual wants ?contractorId=; estimates list schema does not support it yet.
    // Resolve assigned estimate visits via schedule, then filter the estimates page.
    const schedule = await querySchedule({
      contractorId: arg.contractorId,
      kind: "estimate",
      force: true,
      silent: true,
    });
    const estimateIds = new Set(
      schedule
        .filter((item) => item.kind === "estimate")
        .map((item) => item.recordId)
        .filter(Boolean),
    );
    const result = await queryEstimates({
      status: arg.status || undefined,
      search: arg.search || undefined,
      page: arg.page ?? 1,
      limit: Math.max(arg.limit ?? DETAIL_TAB_LIMIT, 50),
      force: true,
      silent: true,
    });
    const items = result.items.filter((item) => estimateIds.has(item.id));
    return {
      contractorId: arg.contractorId,
      filterKey,
      items,
      page: result.page,
      total: items.length,
      totalPages: 1,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchContractorSchedule = createAsyncThunk<
  { contractorId: string; filterKey: string; items: PortalCalendarEvent[] },
  ContractorTabArg,
  { state: { contractors: ContractorsState }; rejectValue: string }
>("contractors/fetchSchedule", async (arg, { rejectWithValue }) => {
  const filterKey = tabCacheKey(arg);
  try {
    const items = await querySchedule({
      contractorId: arg.contractorId,
      kind: arg.kind || undefined,
      force: true,
      silent: true,
    });
    return {
      contractorId: arg.contractorId,
      filterKey,
      items,
    };
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
    clearContractorDetail(state) {
      state.detail = null;
      state.detailError = null;
      state.detailLoading = false;
      state.jobs = emptyTabList();
      state.estimates = emptyTabList();
      state.schedule = emptyTabList();
    },
    setContractorAvailability(
      state,
      action: PayloadAction<{ contractorId: string; workingHours: PortalEmployeeWorkingHours[] }>,
    ) {
      state.availabilityById[action.payload.contractorId] = action.payload.workingHours;
    },
    /** Drop tab caches that do not belong to this contractor (contractor switch). */
    bindContractorDetail(state, action: PayloadAction<string>) {
      const contractorId = action.payload;
      if (state.jobs.contractorId && state.jobs.contractorId !== contractorId) {
        state.jobs = emptyTabList();
      }
      if (state.estimates.contractorId && state.estimates.contractorId !== contractorId) {
        state.estimates = emptyTabList();
      }
      if (state.schedule.contractorId && state.schedule.contractorId !== contractorId) {
        state.schedule = emptyTabList();
      }
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
      .addCase(fetchContractorDetail.pending, (state, action) => {
        const nextId = action.meta.arg;
        const previousId = state.detail?.id;
        state.detailLoading = true;
        state.detailError = null;
        if (previousId && previousId !== nextId) {
          state.jobs = emptyTabList();
          state.estimates = emptyTabList();
          state.schedule = emptyTabList();
        } else if (!previousId) {
          if (state.jobs.contractorId && state.jobs.contractorId !== nextId) {
            state.jobs = emptyTabList();
          }
          if (state.estimates.contractorId && state.estimates.contractorId !== nextId) {
            state.estimates = emptyTabList();
          }
          if (state.schedule.contractorId && state.schedule.contractorId !== nextId) {
            state.schedule = emptyTabList();
          }
        }
      })
      .addCase(fetchContractorDetail.fulfilled, (state, action) => {
        applyDetail(state, action.payload);
      })
      .addCase(fetchContractorDetail.rejected, (state, action) => {
        state.detailLoading = false;
        state.detailError = action.payload || "Failed to load contractor.";
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
        applyDetail(state, action.payload);
      })
      .addCase(deleteContractorRecord.fulfilled, (state, action) => {
        state.pagesCache = {};
        state.items = state.items.filter((item) => item.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
        if (state.detail?.id === action.payload) {
          state.detail = null;
          state.jobs = emptyTabList();
          state.estimates = emptyTabList();
          state.schedule = emptyTabList();
        }
      })
      .addCase(fetchContractorJobs.pending, (state, action) => {
        setTabPending(state.jobs, action.meta.arg.contractorId, tabCacheKey(action.meta.arg));
      })
      .addCase(fetchContractorJobs.fulfilled, (state, action) => {
        setTabFulfilled(state.jobs, action.payload);
      })
      .addCase(fetchContractorJobs.rejected, (state, action) => {
        setTabRejected(state.jobs, action.payload || "Failed to load jobs.");
      })
      .addCase(fetchContractorEstimates.pending, (state, action) => {
        setTabPending(state.estimates, action.meta.arg.contractorId, tabCacheKey(action.meta.arg));
      })
      .addCase(fetchContractorEstimates.fulfilled, (state, action) => {
        setTabFulfilled(state.estimates, action.payload);
      })
      .addCase(fetchContractorEstimates.rejected, (state, action) => {
        setTabRejected(state.estimates, action.payload || "Failed to load estimates.");
      })
      .addCase(fetchContractorSchedule.pending, (state, action) => {
        setTabPending(state.schedule, action.meta.arg.contractorId, tabCacheKey(action.meta.arg));
      })
      .addCase(fetchContractorSchedule.fulfilled, (state, action) => {
        setTabFulfilled(state.schedule, action.payload);
      })
      .addCase(fetchContractorSchedule.rejected, (state, action) => {
        setTabRejected(state.schedule, action.payload || "Failed to load schedule.");
      });
  },
});

export const {
  setContractorsSearch,
  setContractorsPage,
  setContractorsStatus,
  invalidateContractorsCache,
  clearContractorsError,
  clearContractorDetail,
  bindContractorDetail,
  setContractorAvailability,
} = contractorsSlice.actions;

export default contractorsSlice.reducer;
