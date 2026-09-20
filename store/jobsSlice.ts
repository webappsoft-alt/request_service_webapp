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
  updateJobArchive,
  updateJobStatus,
} from "@/lib/api/crm-client";
import type { Invoice, Job } from "@/lib/types";
import type { PortalEmployee } from "@/lib/data/portal";

/** Default page size for GET /api/provider/jobs */
export const JOBS_DEFAULT_LIMIT = 20;

/** Board filter from URL — empty means all active (non-archived). */
export type JobListStatus = "" | Job["status"] | "archived";

export type JobsState = {
  items: Job[];
  /** Cached list rows keyed by `archived|status|search|page|limit` */
  pagesCache: Record<string, Job[]>;
  detailsCache: Record<string, Job>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  search: string;
  status: string;
  isArchived: boolean;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  detailLoading: boolean;
  detailError: string | null;
};

export function jobsCacheKey(
  search = "",
  status = "",
  isArchived = false,
  page = 1,
  limit = JOBS_DEFAULT_LIMIT,
) {
  return `${isArchived ? "archived" : "active"}|${status.trim()}|${search.trim()}|${page}|${limit}`;
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
  isArchived: false,
  loading: false,
  mutating: false,
  error: null,
  detailLoading: false,
  detailError: null,
};

function applyJobToState(state: JobsState, job: Job) {
  state.detailsCache[job.id] = job;
  const idx = state.items.findIndex((x) => x.id === job.id);
  if (idx >= 0) state.items[idx] = job;
  for (const k of Object.keys(state.pagesCache)) {
    state.pagesCache[k] = state.pagesCache[k].map((item) =>
      item.id === job.id ? job : item,
    );
  }
}

// ─── Thunks ──────────────────────────────────────────────────────────────────

export const fetchJobs = createAsyncThunk<
  {
    items: Job[];
    page: number;
    total: number;
    totalPages: number;
    search: string;
    status: string;
    isArchived: boolean;
    cacheKey: string;
  },
  {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    isArchived?: boolean;
    force?: boolean;
    silent?: boolean;
  } | void,
  { state: { jobs: JobsState }; rejectValue: string }
>("jobs/fetchList", async (params, { getState, rejectWithValue }) => {
  const state = getState().jobs ?? initialState;
  const hasParams = params !== undefined && params !== null;
  const targetPage = params?.page ?? state.page;
  const targetLimit = params?.limit ?? state.limit;
  const rawStatus =
    hasParams && "status" in params ? (params.status || "") : state.status;
  const targetArchived =
    hasParams && "isArchived" in params
      ? Boolean(params.isArchived)
      : rawStatus === "archived"
        ? true
        : state.isArchived;
  // Never send UI "archived" as lifecycle status.
  const targetStatus = rawStatus === "archived" ? "" : rawStatus;
  const targetSearch =
    hasParams && "search" in params ? (params.search || "") : state.search;
  const key = jobsCacheKey(
    targetSearch,
    targetStatus,
    targetArchived,
    targetPage,
    targetLimit,
  );

  try {
    const result = await queryJobs({
      page: targetPage,
      limit: targetLimit,
      search: targetSearch.trim() || undefined,
      status: targetStatus.trim() || undefined,
      isArchived: targetArchived,
      force: params?.force ?? true,
      silent: params?.silent ?? true,
    });
    return {
      items: result.items,
      page: result.page ?? targetPage,
      total: result.total,
      totalPages: result.totalPages,
      search: targetSearch,
      status: targetStatus,
      isArchived: targetArchived,
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

export const patchJobArchive = createAsyncThunk<
  Job,
  { id: string; isArchived: boolean },
  { rejectValue: string }
>("jobs/patchArchive", async ({ id, isArchived }, { rejectWithValue }) => {
  try {
    const updated = await updateJobArchive(id, isArchived);
    if (!updated) {
      return rejectWithValue("Job archive was updated but could not be read.");
    }
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const convertJobToInvoiceRecord = createAsyncThunk<
  { invoice: Invoice; jobId: string },
  string,
  { rejectValue: string }
>("jobs/convertToInvoice", async (id, { rejectWithValue }) => {
  try {
    const invoice = await convertJobToInvoice(id);
    if (!invoice) return rejectWithValue("Failed to convert job to invoice.");
    return { invoice, jobId: id };
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
      state.pagesCache = {};
    },
    setJobsPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
      const key = jobsCacheKey(
        state.search,
        state.status,
        state.isArchived,
        state.page,
        state.limit,
      );
      if (key in state.pagesCache) state.items = state.pagesCache[key];
    },
    setJobsStatus(state, action: PayloadAction<string>) {
      state.status = action.payload === "archived" ? "" : action.payload;
      state.isArchived = action.payload === "archived";
      state.page = 1;
      state.pagesCache = {};
    },
    setJobsArchived(state, action: PayloadAction<boolean>) {
      state.isArchived = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    /** Apply board filter from URL: all | status | archived */
    setJobsListFilter(state, action: PayloadAction<JobListStatus>) {
      const filter = action.payload;
      state.page = 1;
      state.pagesCache = {};
      if (filter === "archived") {
        state.isArchived = true;
        state.status = "";
        return;
      }
      state.isArchived = false;
      state.status = filter === "" ? "" : filter;
    },
    invalidateJobsCache(state) {
      state.pagesCache = {};
    },
    clearJobsError(state) {
      state.error = null;
    },
    upsertJobItem(state, action: PayloadAction<Job>) {
      state.pagesCache = {};
      applyJobToState(state, action.payload);
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
      .addCase(fetchJobs.pending, (state, action) => {
        const p = action.meta.arg;
        const hasParams = p !== undefined && p !== null;
        const targetSearch =
          hasParams && "search" in p ? (p.search || "") : state.search;
        const rawStatus =
          hasParams && "status" in p ? (p.status || "") : state.status;
        const targetArchived =
          hasParams && "isArchived" in p
            ? Boolean(p.isArchived)
            : rawStatus === "archived"
              ? true
              : state.isArchived;
        const targetStatus = rawStatus === "archived" ? "" : rawStatus;
        const targetPage = p?.page ?? state.page;
        const targetLimit = p?.limit ?? state.limit;
        const key = jobsCacheKey(
          targetSearch,
          targetStatus,
          targetArchived,
          targetPage,
          targetLimit,
        );

        state.search = targetSearch;
        state.status = targetStatus;
        state.isArchived = targetArchived;
        state.page = targetPage;
        state.limit = targetLimit;
        state.error = null;

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
        state.isArchived = action.payload.isArchived;
        for (const item of action.payload.items) {
          state.detailsCache[item.id] = item;
        }
        state.pagesCache[action.payload.cacheKey] = action.payload.items;
      })
      .addCase(fetchJobs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to load jobs.";
      })

      .addCase(fetchJobDetail.pending, (state, action) => {
        state.detailError = null;
        const id = action.meta.arg;
        if (!state.detailsCache[id]) {
          state.detailLoading = true;
        }
      })
      .addCase(fetchJobDetail.fulfilled, (state, action) => {
        state.detailLoading = false;
        applyJobToState(state, action.payload);
      })
      .addCase(fetchJobDetail.rejected, (state, action) => {
        state.detailLoading = false;
        state.detailError = action.payload ?? "Failed to fetch job details.";
      })

      .addCase(createJobRecord.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(createJobRecord.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        applyJobToState(state, action.payload);
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

      .addCase(updateJobRecord.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(updateJobRecord.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        applyJobToState(state, action.payload);
      })
      .addCase(updateJobRecord.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? "Failed to update job.";
      })

      .addCase(patchJobStatus.fulfilled, (state, action) => {
        state.pagesCache = {};
        applyJobToState(state, action.payload);
      })

      .addCase(patchJobArchive.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(patchJobArchive.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        const updated = action.payload;
        applyJobToState(state, updated);
        const matchesArchive = Boolean(updated.isArchived) === state.isArchived;
        if (!matchesArchive) {
          state.items = state.items.filter((item) => item.id !== updated.id);
          state.total = Math.max(0, state.total - 1);
        }
      })
      .addCase(patchJobArchive.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? "Failed to update job archive.";
      })

      .addCase(convertJobToInvoiceRecord.fulfilled, (state, action) => {
        state.pagesCache = {};
        const { invoice, jobId } = action.payload;
        const existing = state.detailsCache[jobId];
        if (existing) {
          applyJobToState(state, {
            ...existing,
            status: "invoiced",
            invoiceId: invoice.id,
          });
        } else {
          state.items = state.items.map((item) =>
            item.id === jobId
              ? { ...item, status: "invoiced", invoiceId: invoice.id }
              : item,
          );
        }
      })

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
  setJobsArchived,
  setJobsListFilter,
  invalidateJobsCache,
  clearJobsError,
  upsertJobItem,
  patchJobLocally,
  removeJobItemLocal,
} = jobsSlice.actions;

export default jobsSlice.reducer;
