import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import {
  convertJobToInvoice,
  createJob,
  deleteJob,
  getJob,
  queryJobs,
  updateJob,
  updateJobStatus,
} from "@/lib/api/crm-client";
import type { Invoice, Job } from "@/lib/types";
import type { PortalEmployee } from "@/lib/data/portal";

/** Default page size for GET /api/provider/jobs */
export const JOBS_DEFAULT_LIMIT = 20;

export type JobsState = {
  items: Job[];
  /** Cached list rows keyed by `status|search|page|limit` for soft page switches */
  pagesCache: Record<string, Job[]>;
  detailsCache: Record<string, Job>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  search: string;
  status: string;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  detailLoading: boolean;
  detailError: string | null;
};

export function jobsCacheKey(
  search = "",
  status = "",
  page = 1,
  limit = JOBS_DEFAULT_LIMIT,
) {
  return `${status.trim()}|${search.trim()}|${page}|${limit}`;
}

const initialState: JobsState = {
  items: [],
  pagesCache: {},
  detailsCache: {},
  page: 1,
  limit: JOBS_DEFAULT_LIMIT,
  total: 0,
  totalPages: 1,
  search: "",
  status: "",
  loading: false,
  mutating: false,
  error: null,
  detailLoading: false,
  detailError: null,
};

// ─── Thunks ──────────────────────────────────────────────────────────────────

export const fetchJobs = createAsyncThunk<
  {
    items: Job[];
    page: number;
    total: number;
    totalPages: number;
    search: string;
    status: string;
    cacheKey: string;
  },
  {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    force?: boolean;
    silent?: boolean;
  } | void,
  { state: { jobs: JobsState }; rejectValue: string }
>("jobs/fetchList", async (params, { getState, rejectWithValue }) => {
  const state = getState().jobs ?? initialState;
  const hasParams = params !== undefined && params !== null;
  const targetPage = params?.page ?? state.page;
  const targetLimit = params?.limit ?? state.limit;
  const targetStatus =
    hasParams && "status" in params ? (params.status || "") : state.status;
  const targetSearch =
    hasParams && "search" in params ? (params.search || "") : state.search;
  const key = jobsCacheKey(targetSearch, targetStatus, targetPage, targetLimit);

  try {
    const result = await queryJobs({
      page: targetPage,
      limit: targetLimit,
      search: targetSearch.trim() || undefined,
      status: targetStatus.trim() || undefined,
      force: true,
      silent: params?.silent ?? true,
    });
    return {
      items: result.items,
      page: result.page ?? targetPage,
      total: result.total,
      totalPages: result.totalPages,
      search: targetSearch,
      status: targetStatus,
      cacheKey: key,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchJobDetail = createAsyncThunk<
  Job,
  string,
  { state: { jobs: JobsState }; rejectValue: string }
>("jobs/fetchDetail", async (id, { rejectWithValue }) => {
  try {
    const item = await getJob(id);
    if (!item) return rejectWithValue("Job not found.");
    return item;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const createJobRecord = createAsyncThunk<
  Job,
  { job: Job; employees: PortalEmployee[] },
  { rejectValue: string }
>("jobs/create", async ({ job, employees }, { rejectWithValue }) => {
  try {
    const created = await createJob(job, employees);
    if (!created) return rejectWithValue("Job was created but could not be read.");
    return created;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const updateJobRecord = createAsyncThunk<
  Job,
  { id: string; job: Job; employees: PortalEmployee[] },
  { rejectValue: string }
>("jobs/update", async ({ id, job, employees }, { rejectWithValue }) => {
  try {
    const updated = await updateJob(id, job, employees);
    if (!updated) return rejectWithValue("Job was updated but could not be read.");
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const patchJobStatus = createAsyncThunk<
  Job,
  { id: string; status: Job["status"]; notes?: string },
  { rejectValue: string }
>("jobs/patchStatus", async ({ id, status, notes }, { rejectWithValue }) => {
  try {
    const updated = await updateJobStatus(id, status, notes ?? "");
    if (!updated) return rejectWithValue("Job status was updated but could not be read.");
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const convertJobToInvoiceRecord = createAsyncThunk<
  Invoice,
  string,
  { rejectValue: string }
>("jobs/convertToInvoice", async (id, { rejectWithValue }) => {
  try {
    const invoice = await convertJobToInvoice(id);
    if (!invoice) return rejectWithValue("Failed to convert job to invoice.");
    return invoice;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const deleteJobRecord = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>("jobs/delete", async (id, { rejectWithValue }) => {
  try {
    await deleteJob(id);
    return id;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

// ─── Slice ────────────────────────────────────────────────────────────────────

const jobsSlice = createSlice({
  name: "jobs",
  initialState,
  reducers: {
    setJobsSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.page = 1;
      const key = jobsCacheKey(state.search, state.status, 1, state.limit);
      if (key in state.pagesCache && state.pagesCache[key].length > 0) {
        state.items = state.pagesCache[key];
        state.loading = false;
      } else {
        state.items = state.pagesCache[key] ?? [];
        state.loading = true;
      }
    },
    setJobsPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
      const key = jobsCacheKey(state.search, state.status, state.page, state.limit);
      if (key in state.pagesCache && state.pagesCache[key].length > 0) {
        state.items = state.pagesCache[key];
        state.loading = false;
      } else {
        state.items = state.pagesCache[key] ?? [];
        state.loading = true;
      }
    },
    setJobsStatus(state, action: PayloadAction<string>) {
      state.status = action.payload;
      state.page = 1;
      const key = jobsCacheKey(state.search, state.status, 1, state.limit);
      if (key in state.pagesCache && state.pagesCache[key].length > 0) {
        state.items = state.pagesCache[key];
        state.loading = false;
      } else {
        state.items = state.pagesCache[key] ?? [];
        state.loading = true;
      }
    },
    invalidateJobsCache(state) {
      state.pagesCache = {};
    },
    clearJobsError(state) {
      state.error = null;
    },
    upsertJobItem(state, action: PayloadAction<Job>) {
      state.pagesCache = {};
      state.detailsCache[action.payload.id] = action.payload;
      state.items = [
        action.payload,
        ...state.items.filter((item) => item.id !== action.payload.id),
      ];
      state.total = Math.max(state.total, state.items.length);
    },
    patchJobLocally(
      state,
      action: PayloadAction<{ id: string; patch: Partial<Job> }>,
    ) {
      const { id, patch } = action.payload;
      if (state.detailsCache[id]) {
        state.detailsCache[id] = { ...state.detailsCache[id], ...patch };
      }
      state.items = state.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      );
      for (const k of Object.keys(state.pagesCache)) {
        state.pagesCache[k] = state.pagesCache[k].map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        );
      }
    },
    removeJobItemLocal(state, action: PayloadAction<string>) {
      state.pagesCache = {};
      delete state.detailsCache[action.payload];
      state.items = state.items.filter((item) => item.id !== action.payload);
      state.total = Math.max(0, state.total - 1);
    },
  },
  extraReducers: (builder) => {
    builder
      // ── fetchJobs ──
      .addCase(fetchJobs.pending, (state, action) => {
        const p = action.meta.arg;
        const hasParams = p !== undefined && p !== null;
        const targetSearch =
          hasParams && "search" in p ? (p.search || "") : state.search;
        const targetStatus =
          hasParams && "status" in p ? (p.status || "") : state.status;
        const targetPage = p?.page ?? state.page;
        const targetLimit = p?.limit ?? state.limit;
        const key = jobsCacheKey(targetSearch, targetStatus, targetPage, targetLimit);

        state.search = targetSearch;
        state.status = targetStatus;
        state.page = targetPage;
        state.limit = targetLimit;
        state.error = null;

        // Show cached data immediately; only show spinner when cache is empty
        if (key in state.pagesCache && state.pagesCache[key].length > 0) {
          state.items = state.pagesCache[key];
          state.loading = false;
        } else {
          state.items = state.pagesCache[key] ?? [];
          state.loading = true;
        }
      })
      .addCase(fetchJobs.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.page = action.payload.page;
        state.total = action.payload.total;
        state.totalPages = Math.max(1, action.payload.totalPages);
        state.search = action.payload.search;
        state.status = action.payload.status;
        for (const item of action.payload.items) {
          state.detailsCache[item.id] = item;
        }
        state.pagesCache[action.payload.cacheKey] = action.payload.items;
      })
      .addCase(fetchJobs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to load jobs.";
      })

      // ── fetchJobDetail ──
      .addCase(fetchJobDetail.pending, (state, action) => {
        state.detailError = null;
        const id = action.meta.arg;
        if (!state.detailsCache[id]) {
          state.detailLoading = true;
        }
      })
      .addCase(fetchJobDetail.fulfilled, (state, action) => {
        state.detailLoading = false;
        const item = action.payload;
        state.detailsCache[item.id] = item;
        const idx = state.items.findIndex((x) => x.id === item.id);
        if (idx >= 0) state.items[idx] = item;
      })
      .addCase(fetchJobDetail.rejected, (state, action) => {
        state.detailLoading = false;
        state.detailError = action.payload ?? "Failed to fetch job details.";
      })

      // ── createJobRecord ──
      .addCase(createJobRecord.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(createJobRecord.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        state.detailsCache[action.payload.id] = action.payload;
        state.page = 1;
        state.items = [
          action.payload,
          ...state.items.filter((item) => item.id !== action.payload.id),
        ];
        state.total += 1;
      })
      .addCase(createJobRecord.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? "Failed to create job.";
      })

      // ── updateJobRecord ──
      .addCase(updateJobRecord.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(updateJobRecord.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        const updated = action.payload;
        state.detailsCache[updated.id] = updated;
        state.items = state.items.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        );
      })
      .addCase(updateJobRecord.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? "Failed to update job.";
      })

      // ── patchJobStatus ──
      .addCase(patchJobStatus.fulfilled, (state, action) => {
        const updated = action.payload;
        if (state.detailsCache[updated.id]) {
          state.detailsCache[updated.id] = {
            ...state.detailsCache[updated.id],
            ...updated,
          };
        }
        state.items = state.items.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        );
        for (const k of Object.keys(state.pagesCache)) {
          state.pagesCache[k] = state.pagesCache[k].map((item) =>
            item.id === updated.id ? { ...item, ...updated } : item,
          );
        }
      })

      // ── convertJobToInvoiceRecord ──
      .addCase(convertJobToInvoiceRecord.fulfilled, (state) => {
        state.pagesCache = {};
      })

      // ── deleteJobRecord ──
      .addCase(deleteJobRecord.fulfilled, (state, action) => {
        state.pagesCache = {};
        delete state.detailsCache[action.payload];
        state.items = state.items.filter((item) => item.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
      });
  },
});

export const {
  setJobsSearch,
  setJobsPage,
  setJobsStatus,
  invalidateJobsCache,
  clearJobsError,
  upsertJobItem,
  patchJobLocally,
  removeJobItemLocal,
} = jobsSlice.actions;

export default jobsSlice.reducer;
